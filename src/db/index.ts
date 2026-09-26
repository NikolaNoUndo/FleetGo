import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL nije podešen. Pogledaj README i .env.example.");
}

// Supabase transaction pooler (port 6543) does not support prepared statements.
const globalForDb = globalThis as unknown as { __fleetgoSql?: ReturnType<typeof postgres> };
const sql =
  globalForDb.__fleetgoSql ??
  postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 3,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__fleetgoSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
