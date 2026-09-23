import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (database) return database;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required at runtime");
  }

  const client = postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : process.env.NODE_ENV === "test" ? 5 : 1,
    prepare: false,
  });
  database = drizzle(client, { schema });
  return database;
}
