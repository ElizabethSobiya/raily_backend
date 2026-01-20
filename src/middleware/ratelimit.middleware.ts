import { Context, Next } from "hono";
import { redis } from "../config/redis.js";
import { HTTP_STATUS } from "../utils/constants.js";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (c: Context) => string;
  skipOnError?: boolean;
  message?: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "15") * 60 * 1000, // 15 minutes
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  skipOnError: true,
  message: "Too many requests, please try again later",
};

/**
 * Rate limiting middleware using Redis sliding window
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const options = { ...defaultConfig, ...config };

  return async (c: Context, next: Next) => {
    const key = options.keyGenerator
      ? options.keyGenerator(c)
      : `ratelimit:${c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "anonymous"}`;

    try {
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Use Redis sorted set for sliding window
      const multi = redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Count requests in window
      multi.zcard(key);

      // Set expiry on the key
      multi.pexpire(key, options.windowMs);

      const results = await multi.exec();

      if (!results) {
        if (options.skipOnError) {
          await next();
          return;
        }
        throw new Error("Redis multi exec failed");
      }

      const requestCount = results[2]?.[1] as number;

      // Set rate limit headers
      c.header("X-RateLimit-Limit", options.maxRequests.toString());
      c.header("X-RateLimit-Remaining", Math.max(0, options.maxRequests - requestCount).toString());
      c.header("X-RateLimit-Reset", Math.ceil((now + options.windowMs) / 1000).toString());

      if (requestCount > options.maxRequests) {
        return c.json(
          {
            success: false,
            error: options.message,
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: Math.ceil(options.windowMs / 1000),
          },
          HTTP_STATUS.TOO_MANY_REQUESTS
        );
      }

      await next();
    } catch (error) {
      if (options.skipOnError) {
        await next();
        return;
      }
      throw error;
    }
  };
}

/**
 * Stricter rate limiter for sensitive endpoints
 */
export function strictRateLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Too many attempts, please try again in a minute",
  });
}

/**
 * Rate limiter for API endpoints
 */
export function apiRateLimiter() {
  return rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  });
}

/**
 * Rate limiter per user (requires auth)
 */
export function userRateLimiter(maxRequests: number = 100) {
  return rateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests,
    keyGenerator: (c) => {
      const user = c.get("user");
      return user ? `ratelimit:user:${user.id}` : `ratelimit:ip:${c.req.header("x-forwarded-for") || "anonymous"}`;
    },
  });
}
