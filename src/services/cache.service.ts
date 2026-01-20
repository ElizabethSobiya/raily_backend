import { redis, CACHE_KEYS, CACHE_TTL } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export class CacheService {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      return null;
    } catch (error) {
      logger.error({ error, key }, "Cache get error");
      return null;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set(key: string, value: unknown, ttl: number): Promise<boolean> {
    try {
      if (ttl > 0) {
        await redis.setex(key, ttl, JSON.stringify(value));
      } else {
        await redis.set(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      logger.error({ error, key }, "Cache set error");
      return false;
    }
  }

  /**
   * Delete cache key
   */
  async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error({ error, key }, "Cache delete error");
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        return await redis.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error({ error, pattern }, "Cache delete pattern error");
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, key }, "Cache exists error");
      return false;
    }
  }

  /**
   * Get or set with callback
   */
  async getOrSet<T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, ttl);
    return value;
  }

  // PNR Cache methods
  async getPNR(pnr: string) {
    return this.get(CACHE_KEYS.pnr(pnr));
  }

  async setPNR(pnr: string, data: unknown) {
    return this.set(CACHE_KEYS.pnr(pnr), data, CACHE_TTL.PNR);
  }

  // Live position cache methods
  async getLivePosition(trainNumber: string, date: string) {
    return this.get(CACHE_KEYS.livePosition(trainNumber, date));
  }

  async setLivePosition(trainNumber: string, date: string, data: unknown) {
    return this.set(CACHE_KEYS.livePosition(trainNumber, date), data, CACHE_TTL.LIVE);
  }

  // Train schedule cache methods
  async getTrainSchedule(trainNumber: string) {
    return this.get(CACHE_KEYS.trainSchedule(trainNumber));
  }

  async setTrainSchedule(trainNumber: string, data: unknown) {
    return this.set(CACHE_KEYS.trainSchedule(trainNumber), data, CACHE_TTL.SCHEDULE);
  }

  // Running status cache methods
  async getRunningStatus(trainNumber: string, date: string) {
    return this.get(CACHE_KEYS.runningStatus(trainNumber, date));
  }

  async setRunningStatus(trainNumber: string, date: string, data: unknown) {
    return this.set(CACHE_KEYS.runningStatus(trainNumber, date), data, 300); // 5 minutes
  }

  // Trains between stations cache methods
  async getTrainsBetween(from: string, to: string, date: string) {
    return this.get(CACHE_KEYS.trainsBetween(from, to, date));
  }

  async setTrainsBetween(from: string, to: string, date: string, data: unknown) {
    return this.set(CACHE_KEYS.trainsBetween(from, to, date), data, CACHE_TTL.TRAINS_BETWEEN);
  }

  // Station cache methods
  async getStation(code: string) {
    return this.get(CACHE_KEYS.station(code));
  }

  async setStation(code: string, data: unknown) {
    return this.set(CACHE_KEYS.station(code), data, 0); // Never expire
  }
}

export const cacheService = new CacheService();
export default cacheService;
