import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
  time,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).unique(),
    phone: varchar("phone", { length: 15 }).unique().notNull(),
    name: varchar("name", { length: 100 }),
    passwordHash: text("password_hash"),
    fcmToken: text("fcm_token"),
    preferences: jsonb("preferences").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
    phoneIdx: index("idx_users_phone").on(table.phone),
  })
);

// Trips (User's saved journeys)
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    trainNumber: varchar("train_number", { length: 10 }).notNull(),
    trainName: varchar("train_name", { length: 100 }),
    pnr: varchar("pnr", { length: 10 }),
    journeyDate: date("journey_date").notNull(),
    sourceStation: varchar("source_station", { length: 10 }).notNull(),
    destinationStation: varchar("destination_station", { length: 10 }).notNull(),
    departureTime: time("departure_time"),
    arrivalTime: time("arrival_time"),
    status: varchar("status", { length: 20 }).default("upcoming"), // upcoming, completed, cancelled
    isLive: boolean("is_live").default(false),
    coach: varchar("coach", { length: 10 }),
    seatBerth: varchar("seat_berth", { length: 20 }),
    delayAlertSent: boolean("delay_alert_sent").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userTripsIdx: index("idx_user_trips").on(table.userId, table.journeyDate),
    trainDateIdx: index("idx_train_date").on(table.trainNumber, table.journeyDate),
    pnrIdx: index("idx_trips_pnr").on(table.pnr),
  })
);

// PNR Status (Cached)
export const pnrCache = pgTable(
  "pnr_cache",
  {
    pnr: varchar("pnr", { length: 10 }).primaryKey(),
    trainNumber: varchar("train_number", { length: 10 }),
    trainName: varchar("train_name", { length: 100 }),
    journeyDate: date("journey_date"),
    sourceStation: varchar("source_station", { length: 10 }),
    destinationStation: varchar("destination_station", { length: 10 }),
    boardingPoint: varchar("boarding_point", { length: 10 }),
    reservationUpTo: varchar("reservation_up_to", { length: 10 }),
    classType: varchar("class_type", { length: 10 }),
    passengers: jsonb("passengers").default([]),
    chartPrepared: boolean("chart_prepared").default(false),
    bookingStatus: varchar("booking_status", { length: 20 }),
    rawData: jsonb("raw_data"),
    cachedAt: timestamp("cached_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    expiryIdx: index("idx_pnr_expiry").on(table.expiresAt),
  })
);

// Train Schedules (Static data)
export const trains = pgTable(
  "trains",
  {
    trainNumber: varchar("train_number", { length: 10 }).primaryKey(),
    trainName: varchar("train_name", { length: 100 }).notNull(),
    trainType: varchar("train_type", { length: 50 }),
    sourceStation: varchar("source_station", { length: 10 }),
    destinationStation: varchar("destination_station", { length: 10 }),
    departureTime: time("departure_time"),
    arrivalTime: time("arrival_time"),
    duration: varchar("duration", { length: 10 }),
    runningDays: jsonb("running_days").default([]), // Array of days [0,1,2,3,4,5,6]
    coaches: jsonb("coaches"),
    avgDelayMinutes: integer("avg_delay_minutes").default(0),
    distance: integer("distance"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    trainNameIdx: index("idx_trains_name").on(table.trainName),
    trainTypeIdx: index("idx_trains_type").on(table.trainType),
  })
);

// Station Master Data
export const stations = pgTable(
  "stations",
  {
    code: varchar("code", { length: 10 }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    city: varchar("city", { length: 50 }),
    state: varchar("state", { length: 50 }),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    zone: varchar("zone", { length: 10 }),
    isJunction: boolean("is_junction").default(false),
  },
  (table) => ({
    stationNameIdx: index("idx_stations_name").on(table.name),
    stationCityIdx: index("idx_stations_city").on(table.city),
  })
);

// Train Stops (Route information)
export const trainStops = pgTable(
  "train_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainNumber: varchar("train_number", { length: 10 })
      .references(() => trains.trainNumber)
      .notNull(),
    stationCode: varchar("station_code", { length: 10 })
      .references(() => stations.code)
      .notNull(),
    arrivalTime: time("arrival_time"),
    departureTime: time("departure_time"),
    haltMinutes: integer("halt_minutes").default(0),
    stopNumber: integer("stop_number").notNull(),
    platform: varchar("platform", { length: 5 }),
    distanceKm: integer("distance_km"),
    dayOffset: integer("day_offset").default(0),
  },
  (table) => ({
    trainRouteIdx: index("idx_train_route").on(table.trainNumber, table.stopNumber),
    stationTrainsIdx: index("idx_station_trains").on(table.stationCode),
  })
);

// Live Train Tracking
export const liveTrainPositions = pgTable(
  "live_train_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainNumber: varchar("train_number", { length: 10 }).notNull(),
    journeyDate: date("journey_date").notNull(),
    currentStation: varchar("current_station", { length: 10 }),
    currentLat: decimal("current_lat", { precision: 10, scale: 8 }),
    currentLng: decimal("current_lng", { precision: 11, scale: 8 }),
    delayMinutes: integer("delay_minutes").default(0),
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
    speedKmph: integer("speed_kmph"),
    nextStation: varchar("next_station", { length: 10 }),
    etaNextStation: timestamp("eta_next_station"),
    status: varchar("status", { length: 20 }).default("running"), // running, arrived, departed
    lastStation: varchar("last_station", { length: 10 }),
    distanceCovered: integer("distance_covered"),
  },
  (table) => ({
    trainLiveIdx: index("idx_train_live").on(table.trainNumber, table.journeyDate),
    lastUpdatedIdx: index("idx_last_updated").on(table.lastUpdated),
  })
);

// Delay History (For predictions)
export const delayHistory = pgTable(
  "delay_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainNumber: varchar("train_number", { length: 10 }).notNull(),
    stationCode: varchar("station_code", { length: 10 }).notNull(),
    journeyDate: date("journey_date").notNull(),
    scheduledTime: timestamp("scheduled_time"),
    actualTime: timestamp("actual_time"),
    delayMinutes: integer("delay_minutes"),
    weatherCondition: varchar("weather_condition", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    trainDelayIdx: index("idx_train_delay").on(table.trainNumber, table.stationCode),
    dateDelayIdx: index("idx_delay_date").on(table.journeyDate),
  })
);

// Notifications
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // delay_alert, platform_change, arrival_reminder
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message"),
    isRead: boolean("is_read").default(false),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    userNotificationsIdx: index("idx_user_notifications").on(table.userId, table.sentAt),
  })
);

// User Search History
export const searchHistory = pgTable(
  "search_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    queryType: varchar("query_type", { length: 20 }).notNull(), // train, pnr, station
    queryValue: varchar("query_value", { length: 100 }).notNull(),
    searchedAt: timestamp("searched_at").defaultNow().notNull(),
  },
  (table) => ({
    userSearchesIdx: index("idx_user_searches").on(table.userId, table.searchedAt),
  })
);

// Seat Availability
export const seatAvailability = pgTable(
  "seat_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainNumber: varchar("train_number", { length: 10 }).notNull(),
    journeyDate: date("journey_date").notNull(),
    sourceStation: varchar("source_station", { length: 10 }).notNull(),
    destinationStation: varchar("destination_station", { length: 10 }).notNull(),
    classType: varchar("class_type", { length: 10 }).notNull(),
    availableSeats: integer("available_seats"),
    status: varchar("status", { length: 20 }), // AVAILABLE, RAC, WL, REGRET
    waitlistNumber: integer("waitlist_number"),
    cachedAt: timestamp("cached_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    availabilityIdx: index("idx_seat_availability").on(
      table.trainNumber,
      table.journeyDate,
      table.classType
    ),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Train = typeof trains.$inferSelect;
export type Station = typeof stations.$inferSelect;
export type PNRCache = typeof pnrCache.$inferSelect;
export type LiveTrainPosition = typeof liveTrainPositions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
