import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const runMigrations = async () => {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/railtrack";

  console.log("Connecting to database...");

  const connection = postgres(connectionString, { max: 1 });
  const db = drizzle(connection);

  console.log("Running migrations...");

  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runMigrations();
