import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database.js";
import { stations, trainStops, trains } from "../../drizzle/schema.js";
import { eq, like, or, asc } from "drizzle-orm";
import { validateQuery, validateParams, paginationSchema, stationCodeSchema } from "../middleware/validation.middleware.js";
import { apiRateLimiter } from "../middleware/ratelimit.middleware.js";
import { throwNotFound } from "../middleware/error.middleware.js";
import { normalizeStationCode } from "../utils/helpers.js";
import { cacheService } from "../services/cache.service.js";

const stationRoutes = new Hono();

// Apply rate limiting
stationRoutes.use("*", apiRateLimiter());

// List all stations (paginated)
stationRoutes.get("/", validateQuery(paginationSchema), async (c) => {
  const query = c.req.query();
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const offset = (page - 1) * limit;

  const stationsList = await db
    .select()
    .from(stations)
    .orderBy(asc(stations.name))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    data: stationsList,
    pagination: {
      page,
      limit,
      hasMore: stationsList.length === limit,
    },
  });
});

// Search stations
const searchSchema = z.object({
  q: z.string().min(2).max(50),
  ...paginationSchema.shape,
});

stationRoutes.get("/search", validateQuery(searchSchema), async (c) => {
  const { q } = c.req.query();
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 20;
  const offset = (page - 1) * limit;

  const searchTerm = `%${q}%`;
  const upperSearchTerm = `%${q.toUpperCase()}%`;

  const results = await db
    .select()
    .from(stations)
    .where(
      or(
        like(stations.name, searchTerm),
        like(stations.code, upperSearchTerm),
        like(stations.city, searchTerm)
      )
    )
    .orderBy(asc(stations.name))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    data: results,
    pagination: {
      page,
      limit,
      hasMore: results.length === limit,
    },
  });
});

// Get popular stations
stationRoutes.get("/popular", async (c) => {
  // Return a predefined list of popular stations
  const popularStations = [
    { code: "NDLS", name: "New Delhi", city: "Delhi" },
    { code: "BCT", name: "Mumbai Central", city: "Mumbai" },
    { code: "CSTM", name: "Chhatrapati Shivaji Terminus", city: "Mumbai" },
    { code: "HWH", name: "Howrah Junction", city: "Kolkata" },
    { code: "MAS", name: "Chennai Central", city: "Chennai" },
    { code: "SBC", name: "Bangalore City Junction", city: "Bengaluru" },
    { code: "JP", name: "Jaipur Junction", city: "Jaipur" },
    { code: "LKO", name: "Lucknow", city: "Lucknow" },
    { code: "ADI", name: "Ahmedabad Junction", city: "Ahmedabad" },
    { code: "PUNE", name: "Pune Junction", city: "Pune" },
    { code: "BPL", name: "Bhopal Junction", city: "Bhopal" },
    { code: "AGC", name: "Agra Cantt", city: "Agra" },
  ];

  return c.json({
    success: true,
    data: popularStations,
  });
});

// Get station details
stationRoutes.get("/:code", validateParams(z.object({ code: stationCodeSchema })), async (c) => {
  const code = normalizeStationCode(c.req.param("code"));

  // Check cache first
  const cached = await cacheService.getStation(code);
  if (cached) {
    return c.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  const station = await db
    .select()
    .from(stations)
    .where(eq(stations.code, code))
    .limit(1);

  if (!station.length) {
    throwNotFound(`Station ${code} not found`);
  }

  // Cache the result
  await cacheService.setStation(code, station[0]);

  return c.json({
    success: true,
    data: station[0],
  });
});

// Get trains at a station
stationRoutes.get(
  "/:code/trains",
  validateParams(z.object({ code: stationCodeSchema })),
  validateQuery(paginationSchema),
  async (c) => {
    const code = normalizeStationCode(c.req.param("code"));
    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 20;
    const offset = (page - 1) * limit;

    const trainsList = await db
      .select({
        trainNumber: trainStops.trainNumber,
        trainName: trains.trainName,
        arrivalTime: trainStops.arrivalTime,
        departureTime: trainStops.departureTime,
        platform: trainStops.platform,
        stopNumber: trainStops.stopNumber,
      })
      .from(trainStops)
      .innerJoin(trains, eq(trainStops.trainNumber, trains.trainNumber))
      .where(eq(trainStops.stationCode, code))
      .orderBy(asc(trainStops.departureTime))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      data: trainsList,
      pagination: {
        page,
        limit,
        hasMore: trainsList.length === limit,
      },
    });
  }
);

// Get arrivals at a station
stationRoutes.get(
  "/:code/arrivals",
  validateParams(z.object({ code: stationCodeSchema })),
  async (c) => {
    const code = normalizeStationCode(c.req.param("code"));
    const limit = Number(c.req.query("limit")) || 10;

    const arrivals = await db
      .select({
        trainNumber: trainStops.trainNumber,
        trainName: trains.trainName,
        arrivalTime: trainStops.arrivalTime,
        platform: trainStops.platform,
        sourceStation: trains.sourceStation,
      })
      .from(trainStops)
      .innerJoin(trains, eq(trainStops.trainNumber, trains.trainNumber))
      .where(eq(trainStops.stationCode, code))
      .orderBy(asc(trainStops.arrivalTime))
      .limit(limit);

    return c.json({
      success: true,
      data: arrivals,
    });
  }
);

// Get departures from a station
stationRoutes.get(
  "/:code/departures",
  validateParams(z.object({ code: stationCodeSchema })),
  async (c) => {
    const code = normalizeStationCode(c.req.param("code"));
    const limit = Number(c.req.query("limit")) || 10;

    const departures = await db
      .select({
        trainNumber: trainStops.trainNumber,
        trainName: trains.trainName,
        departureTime: trainStops.departureTime,
        platform: trainStops.platform,
        destinationStation: trains.destinationStation,
      })
      .from(trainStops)
      .innerJoin(trains, eq(trainStops.trainNumber, trains.trainNumber))
      .where(eq(trainStops.stationCode, code))
      .orderBy(asc(trainStops.departureTime))
      .limit(limit);

    return c.json({
      success: true,
      data: departures,
    });
  }
);

export default stationRoutes;
