import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { corsConfig } from "./config/cors.js";
import { errorMiddleware, notFoundHandler } from "./middleware/error.middleware.js";
import { logger } from "./utils/logger.js";
import { generateRequestId } from "./utils/helpers.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import trainRoutes from "./routes/train.routes.js";
import pnrRoutes from "./routes/pnr.routes.js";
import stationRoutes from "./routes/station.routes.js";
import tripRoutes from "./routes/trip.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = new Hono();

// Global middleware
app.use("*", compress());
app.use("*", secureHeaders());
app.use("*", timing());
app.use("*", corsConfig);
app.use("*", errorMiddleware);

// Request logging and ID
app.use("*", async (c, next) => {
  const requestId = generateRequestId();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  const start = Date.now();

  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("user-agent"),
  }, "Incoming request");

  await next();

  const duration = Date.now() - start;

  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }, "Request completed");
});

// Health check endpoint
app.get("/health", async (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// API version prefix
const api = new Hono();

// Mount routes
api.route("/auth", authRoutes);
api.route("/trains", trainRoutes);
api.route("/pnr", pnrRoutes);
api.route("/stations", stationRoutes);
api.route("/trips", tripRoutes);
api.route("/notifications", notificationRoutes);

// API documentation endpoint
api.get("/", (c) => {
  return c.json({
    name: "Railway Tracking API",
    version: "v1",
    description: "API for Indian Railways train tracking, PNR status, and trip management",
    documentation: "/docs",
    endpoints: {
      auth: {
        "POST /auth/register": "Register new user",
        "POST /auth/login": "Login user",
        "POST /auth/refresh": "Refresh access token",
        "GET /auth/me": "Get current user",
        "PUT /auth/me": "Update profile",
      },
      trains: {
        "GET /trains/search": "Search trains by name/number",
        "GET /trains/:number": "Get train details",
        "GET /trains/:number/schedule": "Get train schedule",
        "GET /trains/:number/live": "Get live running status",
        "GET /trains/between/stations": "Find trains between stations",
      },
      pnr: {
        "GET /pnr/:pnr": "Get PNR status",
        "POST /pnr/check": "Batch check PNRs",
        "GET /pnr/:pnr/passengers": "Get passenger details",
      },
      stations: {
        "GET /stations": "List all stations",
        "GET /stations/search": "Search stations",
        "GET /stations/popular": "Get popular stations",
        "GET /stations/:code": "Get station details",
        "GET /stations/:code/trains": "Get trains at station",
      },
      trips: {
        "GET /trips": "Get user's trips",
        "POST /trips": "Create new trip",
        "GET /trips/:id": "Get trip details",
        "PUT /trips/:id": "Update trip",
        "DELETE /trips/:id": "Delete trip",
        "GET /trips/:id/live": "Get live tracking for trip",
      },
      notifications: {
        "GET /notifications": "Get notifications",
        "PUT /notifications/:id/read": "Mark as read",
        "PUT /notifications/read-all": "Mark all as read",
        "POST /notifications/subscribe": "Subscribe to alerts",
      },
    },
  });
});

// Mount API with version prefix
app.route("/v1", api);

// Also mount at root for convenience
app.route("/api/v1", api);

// 404 handler
app.notFound(notFoundHandler);

// Start server
const port = parseInt(process.env.PORT || "3000");

logger.info({ port }, "Starting server...");

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info({ port: info.port }, `Server running at http://localhost:${info.port}`);
  logger.info(`API available at http://localhost:${info.port}/v1`);
});

export default app;
