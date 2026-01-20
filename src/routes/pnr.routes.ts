import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database.js";
import { pnrCache } from "../../drizzle/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { validateParams, validateBody, pnrSchema } from "../middleware/validation.middleware.js";
import { optionalAuthMiddleware, authMiddleware } from "../middleware/auth.middleware.js";
import { apiRateLimiter, strictRateLimiter } from "../middleware/ratelimit.middleware.js";
import { throwNotFound, throwBadRequest } from "../middleware/error.middleware.js";
import { railwayAPIService } from "../services/railway-api.service.js";
import { isValidPNR } from "../utils/helpers.js";
import { CACHE_TTL } from "../config/redis.js";

const pnrRoutes = new Hono();

// Apply rate limiting
pnrRoutes.use("*", apiRateLimiter());

// Get PNR status
pnrRoutes.get(
  "/:pnr",
  optionalAuthMiddleware,
  validateParams(z.object({ pnr: pnrSchema })),
  async (c) => {
    const { pnr } = c.req.param();

    if (!isValidPNR(pnr)) {
      throwBadRequest("Invalid PNR number. Must be 10 digits.");
    }

    // Check database cache first
    const cachedPNR = await db
      .select()
      .from(pnrCache)
      .where(and(eq(pnrCache.pnr, pnr), gt(pnrCache.expiresAt, new Date())))
      .limit(1);

    if (cachedPNR.length > 0) {
      return c.json({
        success: true,
        data: {
          pnr: cachedPNR[0].pnr,
          trainNumber: cachedPNR[0].trainNumber,
          trainName: cachedPNR[0].trainName,
          journeyDate: cachedPNR[0].journeyDate,
          boardingPoint: cachedPNR[0].boardingPoint,
          destination: cachedPNR[0].destinationStation,
          reservationUpTo: cachedPNR[0].reservationUpTo,
          classType: cachedPNR[0].classType,
          chartPrepared: cachedPNR[0].chartPrepared,
          passengers: cachedPNR[0].passengers,
        },
        cached: true,
        cachedAt: cachedPNR[0].cachedAt,
      });
    }

    // Fetch from external API
    const pnrStatus = await railwayAPIService.getPNRStatus(pnr);

    if (!pnrStatus) {
      throwNotFound(`PNR ${pnr} not found or status unavailable`);
    }

    // Store in database cache
    const expiresAt = new Date(Date.now() + CACHE_TTL.PNR * 1000);

    await db
      .insert(pnrCache)
      .values({
        pnr: pnrStatus.pnr,
        trainNumber: pnrStatus.trainNumber,
        trainName: pnrStatus.trainName,
        journeyDate: pnrStatus.journeyDate,
        sourceStation: pnrStatus.boardingPoint,
        destinationStation: pnrStatus.destination,
        boardingPoint: pnrStatus.boardingPoint,
        reservationUpTo: pnrStatus.reservationUpTo,
        classType: pnrStatus.classType,
        chartPrepared: pnrStatus.chartPrepared,
        passengers: pnrStatus.passengers,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: pnrCache.pnr,
        set: {
          trainNumber: pnrStatus.trainNumber,
          trainName: pnrStatus.trainName,
          chartPrepared: pnrStatus.chartPrepared,
          passengers: pnrStatus.passengers,
          cachedAt: new Date(),
          expiresAt,
        },
      });

    return c.json({
      success: true,
      data: pnrStatus,
      cached: false,
    });
  }
);

// Batch check multiple PNRs
const batchPNRSchema = z.object({
  pnrs: z.array(pnrSchema).min(1).max(5),
});

pnrRoutes.post(
  "/check",
  authMiddleware,
  strictRateLimiter(),
  validateBody(batchPNRSchema),
  async (c) => {
    const { pnrs } = await c.req.json();

    const results = await Promise.all(
      pnrs.map(async (pnr: string) => {
        try {
          const status = await railwayAPIService.getPNRStatus(pnr);
          return { pnr, success: true, data: status };
        } catch (error) {
          return { pnr, success: false, error: "Failed to fetch PNR status" };
        }
      })
    );

    return c.json({
      success: true,
      data: results,
    });
  }
);

// Get passenger details from PNR
pnrRoutes.get(
  "/:pnr/passengers",
  optionalAuthMiddleware,
  validateParams(z.object({ pnr: pnrSchema })),
  async (c) => {
    const { pnr } = c.req.param();

    // Check cache first
    const cachedPNR = await db
      .select({ passengers: pnrCache.passengers })
      .from(pnrCache)
      .where(and(eq(pnrCache.pnr, pnr), gt(pnrCache.expiresAt, new Date())))
      .limit(1);

    if (cachedPNR.length > 0) {
      return c.json({
        success: true,
        data: cachedPNR[0].passengers,
      });
    }

    // Fetch fresh data
    const pnrStatus = await railwayAPIService.getPNRStatus(pnr);

    if (!pnrStatus) {
      throwNotFound(`PNR ${pnr} not found`);
    }

    return c.json({
      success: true,
      data: pnrStatus.passengers,
    });
  }
);

// Force refresh PNR status
pnrRoutes.post(
  "/:pnr/refresh",
  authMiddleware,
  strictRateLimiter(),
  validateParams(z.object({ pnr: pnrSchema })),
  async (c) => {
    const { pnr } = c.req.param();

    // Delete from cache
    await db.delete(pnrCache).where(eq(pnrCache.pnr, pnr));

    // Fetch fresh data
    const pnrStatus = await railwayAPIService.getPNRStatus(pnr);

    if (!pnrStatus) {
      throwNotFound(`PNR ${pnr} not found`);
    }

    // Store in cache
    const expiresAt = new Date(Date.now() + CACHE_TTL.PNR * 1000);

    await db.insert(pnrCache).values({
      pnr: pnrStatus.pnr,
      trainNumber: pnrStatus.trainNumber,
      trainName: pnrStatus.trainName,
      journeyDate: pnrStatus.journeyDate,
      sourceStation: pnrStatus.boardingPoint,
      destinationStation: pnrStatus.destination,
      boardingPoint: pnrStatus.boardingPoint,
      reservationUpTo: pnrStatus.reservationUpTo,
      classType: pnrStatus.classType,
      chartPrepared: pnrStatus.chartPrepared,
      passengers: pnrStatus.passengers,
      expiresAt,
    });

    return c.json({
      success: true,
      data: pnrStatus,
      refreshed: true,
    });
  }
);

export default pnrRoutes;
