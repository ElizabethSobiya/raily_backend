import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database.js";
import { trips, trains, stations } from "../../drizzle/schema.js";
import { eq, and, desc, asc, gte, lt, or } from "drizzle-orm";
import {
  validateBody,
  validateQuery,
  validateParams,
  paginationSchema,
  trainNumberSchema,
  stationCodeSchema,
  dateSchema,
  pnrSchema,
} from "../middleware/validation.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { apiRateLimiter } from "../middleware/ratelimit.middleware.js";
import { throwNotFound, throwForbidden } from "../middleware/error.middleware.js";
import { railwayAPIService } from "../services/railway-api.service.js";
import { TRIP_STATUS } from "../utils/constants.js";

const tripRoutes = new Hono();

// All trip routes require authentication
tripRoutes.use("*", authMiddleware);
tripRoutes.use("*", apiRateLimiter());

// Validation schemas
const createTripSchema = z.object({
  trainNumber: trainNumberSchema,
  trainName: z.string().max(100).optional(),
  pnr: pnrSchema.optional(),
  journeyDate: dateSchema,
  sourceStation: stationCodeSchema,
  destinationStation: stationCodeSchema,
  departureTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  coach: z.string().max(10).optional(),
  seatBerth: z.string().max(20).optional(),
});

const updateTripSchema = createTripSchema.partial();

const tripQuerySchema = z.object({
  status: z.enum(["upcoming", "completed", "cancelled", "all"]).optional(),
  ...paginationSchema.shape,
});

// Get user's trips
tripRoutes.get("/", validateQuery(tripQuerySchema), async (c) => {
  const user = c.get("user");
  const query = c.req.query();
  const status = query.status || "all";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const offset = (page - 1) * limit;

  const today = new Date().toISOString().split("T")[0];

  let whereClause;
  if (status === "upcoming") {
    whereClause = and(
      eq(trips.userId, user.id),
      gte(trips.journeyDate, today),
      or(eq(trips.status, TRIP_STATUS.UPCOMING), eq(trips.status, TRIP_STATUS.LIVE))
    );
  } else if (status === "completed") {
    whereClause = and(eq(trips.userId, user.id), eq(trips.status, TRIP_STATUS.COMPLETED));
  } else if (status === "cancelled") {
    whereClause = and(eq(trips.userId, user.id), eq(trips.status, TRIP_STATUS.CANCELLED));
  } else {
    whereClause = eq(trips.userId, user.id);
  }

  const userTrips = await db
    .select()
    .from(trips)
    .where(whereClause)
    .orderBy(desc(trips.journeyDate))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    data: userTrips,
    pagination: {
      page,
      limit,
      hasMore: userTrips.length === limit,
    },
  });
});

// Create new trip
tripRoutes.post("/", validateBody(createTripSchema), async (c) => {
  const user = c.get("user");
  const tripData = await c.req.json();

  // Get train details if not provided
  let trainName = tripData.trainName;
  if (!trainName) {
    const train = await db
      .select({ trainName: trains.trainName })
      .from(trains)
      .where(eq(trains.trainNumber, tripData.trainNumber))
      .limit(1);

    if (train.length) {
      trainName = train[0].trainName;
    }
  }

  const [newTrip] = await db
    .insert(trips)
    .values({
      userId: user.id,
      trainNumber: tripData.trainNumber,
      trainName,
      pnr: tripData.pnr,
      journeyDate: tripData.journeyDate,
      sourceStation: tripData.sourceStation.toUpperCase(),
      destinationStation: tripData.destinationStation.toUpperCase(),
      departureTime: tripData.departureTime,
      arrivalTime: tripData.arrivalTime,
      coach: tripData.coach,
      seatBerth: tripData.seatBerth,
      status: TRIP_STATUS.UPCOMING,
    })
    .returning();

  return c.json(
    {
      success: true,
      data: newTrip,
    },
    201
  );
});

// Get trip by ID
tripRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const trip = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);

  if (!trip.length) {
    throwNotFound("Trip not found");
  }

  return c.json({
    success: true,
    data: trip[0],
  });
});

// Update trip
tripRoutes.put("/:id", validateBody(updateTripSchema), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");
  const updates = await c.req.json();

  // Check if trip belongs to user
  const existingTrip = await db
    .select({ id: trips.id, userId: trips.userId })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!existingTrip.length) {
    throwNotFound("Trip not found");
  }

  if (existingTrip[0].userId !== user.id) {
    throwForbidden("You don't have permission to update this trip");
  }

  // Normalize station codes
  if (updates.sourceStation) {
    updates.sourceStation = updates.sourceStation.toUpperCase();
  }
  if (updates.destinationStation) {
    updates.destinationStation = updates.destinationStation.toUpperCase();
  }

  const [updatedTrip] = await db
    .update(trips)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId))
    .returning();

  return c.json({
    success: true,
    data: updatedTrip,
  });
});

// Delete trip
tripRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  // Check if trip belongs to user
  const existingTrip = await db
    .select({ id: trips.id, userId: trips.userId })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!existingTrip.length) {
    throwNotFound("Trip not found");
  }

  if (existingTrip[0].userId !== user.id) {
    throwForbidden("You don't have permission to delete this trip");
  }

  await db.delete(trips).where(eq(trips.id, tripId));

  return c.json({
    success: true,
    message: "Trip deleted successfully",
  });
});

// Get live tracking for a trip
tripRoutes.get("/:id/live", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const trip = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);

  if (!trip.length) {
    throwNotFound("Trip not found");
  }

  // Get live status from API
  const liveStatus = await railwayAPIService.getLiveStatus(
    trip[0].trainNumber,
    trip[0].journeyDate
  );

  // Update trip status if journey is live
  if (liveStatus && !trip[0].isLive) {
    await db.update(trips).set({ isLive: true, status: TRIP_STATUS.LIVE }).where(eq(trips.id, tripId));
  }

  return c.json({
    success: true,
    data: {
      trip: trip[0],
      liveStatus,
    },
  });
});

// Mark trip as completed
tripRoutes.post("/:id/complete", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const existingTrip = await db
    .select({ id: trips.id, userId: trips.userId })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!existingTrip.length) {
    throwNotFound("Trip not found");
  }

  if (existingTrip[0].userId !== user.id) {
    throwForbidden("You don't have permission to update this trip");
  }

  const [updatedTrip] = await db
    .update(trips)
    .set({
      status: TRIP_STATUS.COMPLETED,
      isLive: false,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId))
    .returning();

  return c.json({
    success: true,
    data: updatedTrip,
  });
});

// Get trips by PNR
tripRoutes.get("/pnr/:pnr", validateParams(z.object({ pnr: pnrSchema })), async (c) => {
  const user = c.get("user");
  const { pnr } = c.req.param();

  const tripsByPNR = await db
    .select()
    .from(trips)
    .where(and(eq(trips.pnr, pnr), eq(trips.userId, user.id)));

  return c.json({
    success: true,
    data: tripsByPNR,
  });
});

export default tripRoutes;
