import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema.js";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/railtrack";

// Connection for queries
const queryClient = postgres(connectionString);

// Drizzle instance
export const db = drizzle(queryClient, { schema });

// Export for migrations
export const migrationClient = postgres(connectionString, { max: 1 });

export default db;
