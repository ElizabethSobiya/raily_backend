import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema.js";

// Ensure we use the correct database URL
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/railtrack";
console.log("Database URL:", connectionString.replace(/:[^:@]+@/, ":***@")); // Log URL without password

// Connection for queries
const queryClient = postgres(connectionString);

// Drizzle instance
export const db = drizzle(queryClient, { schema });

// Export for migrations
export const migrationClient = postgres(connectionString, { max: 1 });

export default db;
