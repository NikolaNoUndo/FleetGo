import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

// Created on first use, so `next build` works even when DATABASE_URL is only
// available at runtime (e.g. not yet set on Vercel).
const g = globalThis as unknown as { __roadlineDb?: DB };

function connect(): DB {
  if (g.__roadlineDb) return g.__roadlineDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL nije podešen. Pogledaj README i .env.example.");
  // Supabase transaction pooler (port 6543) does not support prepared statements.
  const sql = postgres(url, { prepare: false, max: process.env.NODE_ENV === "production" ? 5 : 3 });
  g.__roadlineDb = drizzle(sql, { schema });
  return g.__roadlineDb;
}

export const db = new Proxy({} as DB, {
  get(_, prop) {
    const real = connect();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
export { schema };
