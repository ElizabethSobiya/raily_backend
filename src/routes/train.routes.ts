import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database.js";
import { trains, trainStops, stations } from "../../drizzle/schema.js";
import { eq, like, or, and, asc } from "drizzle-orm";
import { validateQuery, validateParams, paginationSchema, trainNumberSchema, stationCodeSchema, dateSchema } from "../middleware/validation.middleware.js";
import { optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import { apiRateLimiter } from "../middleware/ratelimit.middleware.js";
import { throwNotFound } from "../middleware/error.middleware.js";
import { railwayAPIService } from "../services/railway-api.service.js";
import { normalizeStationCode } from "../utils/helpers.js";

const trainRoutes = new Hono();

// Apply rate limiting to all train routes
trainRoutes.use("*", apiRateLimiter());

// Search trains by name or number
const searchSchema = z.object({
  q: z.string().min(2).max(50),
  ...paginationSchema.shape,
});

trainRoutes.get("/search", validateQuery(searchSchema), async (c) => {
  const { q, page, limit } = c.req.query() as unknown as z.infer<typeof searchSchema>;
  const offset = (Number(page) - 1) * Number(limit);

  const searchTerm = `%${q}%`;

  const results = await db
    .select({
      trainNumber: trains.trainNumber,
      trainName: trains.trainName,
      trainType: trains.trainType,
      sourceStation: trains.sourceStation,
      destinationStation: trains.destinationStation,
      departureTime: trains.departureTime,
      arrivalTime: trains.arrivalTime,
      runningDays: trains.runningDays,
    })
    .from(trains)
    .where(or(like(trains.trainNumber, searchTerm), like(trains.trainName, searchTerm)))
    .limit(Number(limit))
    .offset(offset);

  return c.json({
    success: true,
    data: results,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      hasMore: results.length === Number(limit),
    },
  });
});

// Get train details by number
trainRoutes.get("/:trainNumber", validateParams(z.object({ trainNumber: trainNumberSchema })), async (c) => {
  const { trainNumber } = c.req.param();

  const train = await db
    .select()
    .from(trains)
    .where(eq(trains.trainNumber, trainNumber))
    .limit(1);

  if (!train.length) {
    // Try to fetch from external API
    const externalData = await railwayAPIService.getTrainSchedule(trainNumber);
    if (!externalData) {
      throwNotFound(`Train ${trainNumber} not found`);
    }
    return c.json({
      success: true,
      data: externalData,
    });
  }

  return c.json({
    success: true,
    data: train[0],
  });
});

// Get train schedule (route with all stops)
trainRoutes.get("/:trainNumber/schedule", validateParams(z.object({ trainNumber: trainNumberSchema })), async (c) => {
  const { trainNumber } = c.req.param();

  // Try to get from external API first (for live/dynamic data)
  const schedule = await railwayAPIService.getTrainSchedule(trainNumber);
  if (schedule) {
    return c.json({
      success: true,
      data: schedule,
    });
  }

  // Fallback to database
  const train = await db
    .select()
    .from(trains)
    .where(eq(trains.trainNumber, trainNumber))
    .limit(1);

  if (!train.length) {
    throwNotFound(`Train ${trainNumber} not found`);
  }

  const stops = await db
    .select({
      stationCode: trainStops.stationCode,
      stationName: stations.name,
      arrivalTime: trainStops.arrivalTime,
      departureTime: trainStops.departureTime,
      haltMinutes: trainStops.haltMinutes,
      stopNumber: trainStops.stopNumber,
      platform: trainStops.platform,
      distanceKm: trainStops.distanceKm,
      dayOffset: trainStops.dayOffset,
    })
    .from(trainStops)
    .leftJoin(stations, eq(trainStops.stationCode, stations.code))
    .where(eq(trainStops.trainNumber, trainNumber))
    .orderBy(asc(trainStops.stopNumber));

  return c.json({
    success: true,
    data: {
      ...train[0],
      route: stops,
    },
  });
});

// Get live running status
const liveStatusSchema = z.object({
  date: dateSchema,
});

trainRoutes.get("/:trainNumber/live", validateParams(z.object({ trainNumber: trainNumberSchema })), validateQuery(liveStatusSchema), async (c) => {
  const { trainNumber } = c.req.param();
  const { date } = c.req.query();

  const liveStatus = await railwayAPIService.getLiveStatus(trainNumber, date);

  if (!liveStatus) {
    return c.json({
      success: true,
      data: null,
      message: "Live status not available for this train",
    });
  }

  return c.json({
    success: true,
    data: liveStatus,
  });
});

// Get trains between two stations
const trainsBetweenSchema = z.object({
  from: stationCodeSchema,
  to: stationCodeSchema,
  date: dateSchema,
  ...paginationSchema.shape,
});

trainRoutes.get("/between/stations", validateQuery(trainsBetweenSchema), async (c) => {
  const query = c.req.query();
  const from = normalizeStationCode(query.from || "");
  const to = normalizeStationCode(query.to || "");
  const date = query.date || "";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;

  const trainsList = await railwayAPIService.getTrainsBetween(from, to, date);

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const paginatedTrains = trainsList.slice(startIndex, startIndex + limit);

  return c.json({
    success: true,
    data: paginatedTrains,
    pagination: {
      page,
      limit,
      total: trainsList.length,
      hasMore: startIndex + limit < trainsList.length,
    },
  });
});

// Get running status (simpler than live)
trainRoutes.get("/:trainNumber/status", validateParams(z.object({ trainNumber: trainNumberSchema })), async (c) => {
  const { trainNumber } = c.req.param();
  const date = c.req.query("date") || new Date().toISOString().split("T")[0];

  const liveStatus = await railwayAPIService.getLiveStatus(trainNumber, date);

  if (!liveStatus) {
    return c.json({
      success: true,
      data: {
        status: "unknown",
        message: "Running status not available",
      },
    });
  }

  return c.json({
    success: true,
    data: {
      trainNumber: liveStatus.trainNumber,
      trainName: liveStatus.trainName,
      status: liveStatus.status,
      delayMinutes: liveStatus.delayMinutes,
      currentStation: liveStatus.currentStation,
      currentStationName: liveStatus.currentStationName,
      lastUpdated: liveStatus.lastUpdated,
    },
  });
});

export default trainRoutes;
