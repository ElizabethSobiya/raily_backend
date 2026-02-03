import { cors } from "hono/cors";

const isDevelopment = process.env.NODE_ENV === "development";

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:19006",
  "http://localhost:3000",
  "http://192.168.*.*:*",
  "exp://192.168.*.*:*",
];

export const corsConfig = cors({
  origin: (origin) => {
    // In development, allow all origins (for mobile app testing)
    if (isDevelopment || !origin) return "*";

    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed.includes("*")) {
        const pattern = allowed.replace(/\*/g, ".*");
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    return isAllowed ? origin : allowedOrigins[0];
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
  exposeHeaders: ["X-Request-ID", "X-RateLimit-Remaining"],
  maxAge: 86400,
});

export default corsConfig;
