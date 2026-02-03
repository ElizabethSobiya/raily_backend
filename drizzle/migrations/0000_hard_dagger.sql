CREATE TABLE "delay_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"train_number" varchar(10) NOT NULL,
	"station_code" varchar(10) NOT NULL,
	"journey_date" date NOT NULL,
	"scheduled_time" timestamp,
	"actual_time" timestamp,
	"delay_minutes" integer,
	"weather_condition" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_train_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"train_number" varchar(10) NOT NULL,
	"journey_date" date NOT NULL,
	"current_station" varchar(10),
	"current_lat" numeric(10, 8),
	"current_lng" numeric(11, 8),
	"delay_minutes" integer DEFAULT 0,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"speed_kmph" integer,
	"next_station" varchar(10),
	"eta_next_station" timestamp,
	"status" varchar(20) DEFAULT 'running',
	"last_station" varchar(10),
	"distance_covered" integer
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" uuid,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "pnr_cache" (
	"pnr" varchar(10) PRIMARY KEY NOT NULL,
	"train_number" varchar(10),
	"train_name" varchar(100),
	"journey_date" date,
	"source_station" varchar(10),
	"destination_station" varchar(10),
	"boarding_point" varchar(10),
	"reservation_up_to" varchar(10),
	"class_type" varchar(10),
	"passengers" jsonb DEFAULT '[]'::jsonb,
	"chart_prepared" boolean DEFAULT false,
	"booking_status" varchar(20),
	"raw_data" jsonb,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query_type" varchar(20) NOT NULL,
	"query_value" varchar(100) NOT NULL,
	"searched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"train_number" varchar(10) NOT NULL,
	"journey_date" date NOT NULL,
	"source_station" varchar(10) NOT NULL,
	"destination_station" varchar(10) NOT NULL,
	"class_type" varchar(10) NOT NULL,
	"available_seats" integer,
	"status" varchar(20),
	"waitlist_number" integer,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"city" varchar(50),
	"state" varchar(50),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"zone" varchar(10),
	"is_junction" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "train_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"train_number" varchar(10) NOT NULL,
	"station_code" varchar(10) NOT NULL,
	"arrival_time" time,
	"departure_time" time,
	"halt_minutes" integer DEFAULT 0,
	"stop_number" integer NOT NULL,
	"platform" varchar(5),
	"distance_km" integer,
	"day_offset" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "trains" (
	"train_number" varchar(10) PRIMARY KEY NOT NULL,
	"train_name" varchar(100) NOT NULL,
	"train_type" varchar(50),
	"source_station" varchar(10),
	"destination_station" varchar(10),
	"departure_time" time,
	"arrival_time" time,
	"duration" varchar(10),
	"running_days" jsonb DEFAULT '[]'::jsonb,
	"coaches" jsonb,
	"avg_delay_minutes" integer DEFAULT 0,
	"distance" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"train_number" varchar(10) NOT NULL,
	"train_name" varchar(100),
	"pnr" varchar(10),
	"journey_date" date NOT NULL,
	"source_station" varchar(10) NOT NULL,
	"destination_station" varchar(10) NOT NULL,
	"departure_time" time,
	"arrival_time" time,
	"status" varchar(20) DEFAULT 'upcoming',
	"is_live" boolean DEFAULT false,
	"coach" varchar(10),
	"seat_berth" varchar(20),
	"delay_alert_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"phone" varchar(15) NOT NULL,
	"name" varchar(100),
	"password_hash" text,
	"fcm_token" text,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_stops" ADD CONSTRAINT "train_stops_train_number_trains_train_number_fk" FOREIGN KEY ("train_number") REFERENCES "public"."trains"("train_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_stops" ADD CONSTRAINT "train_stops_station_code_stations_code_fk" FOREIGN KEY ("station_code") REFERENCES "public"."stations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_train_delay" ON "delay_history" USING btree ("train_number","station_code");--> statement-breakpoint
CREATE INDEX "idx_delay_date" ON "delay_history" USING btree ("journey_date");--> statement-breakpoint
CREATE INDEX "idx_train_live" ON "live_train_positions" USING btree ("train_number","journey_date");--> statement-breakpoint
CREATE INDEX "idx_last_updated" ON "live_train_positions" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "idx_user_notifications" ON "notifications" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "idx_pnr_expiry" ON "pnr_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_searches" ON "search_history" USING btree ("user_id","searched_at");--> statement-breakpoint
CREATE INDEX "idx_seat_availability" ON "seat_availability" USING btree ("train_number","journey_date","class_type");--> statement-breakpoint
CREATE INDEX "idx_stations_name" ON "stations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_stations_city" ON "stations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_train_route" ON "train_stops" USING btree ("train_number","stop_number");--> statement-breakpoint
CREATE INDEX "idx_station_trains" ON "train_stops" USING btree ("station_code");--> statement-breakpoint
CREATE INDEX "idx_trains_name" ON "trains" USING btree ("train_name");--> statement-breakpoint
CREATE INDEX "idx_trains_type" ON "trains" USING btree ("train_type");--> statement-breakpoint
CREATE INDEX "idx_user_trips" ON "trips" USING btree ("user_id","journey_date");--> statement-breakpoint
CREATE INDEX "idx_train_date" ON "trips" USING btree ("train_number","journey_date");--> statement-breakpoint
CREATE INDEX "idx_trips_pnr" ON "trips" USING btree ("pnr");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_phone" ON "users" USING btree ("phone");