import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 3000);
  },
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

// Cache key helpers
export const CACHE_KEYS = {
  pnr: (pnr: string) => `pnr:${pnr}`,
  livePosition: (trainNum: string, date: string) => `live:${trainNum}:${date}`,
  trainSchedule: (trainNum: string) => `train:schedule:${trainNum}`,
  station: (code: string) => `station:${code}`,
  runningStatus: (trainNum: string, date: string) => `status:${trainNum}:${date}`,
  trainsBetween: (from: string, to: string, date: string) => `trains:${from}:${to}:${date}`,
  userSession: (userId: string) => `session:${userId}`,
};

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  PNR: parseInt(process.env.CACHE_TTL_PNR || "1800"), // 30 minutes
  LIVE: parseInt(process.env.CACHE_TTL_LIVE || "30"), // 30 seconds
  SCHEDULE: parseInt(process.env.CACHE_TTL_SCHEDULE || "86400"), // 24 hours
  STATION: 0, // Never expire
  TRAINS_BETWEEN: 3600, // 1 hour
  SESSION: 604800, // 7 days
};

export default redis;
