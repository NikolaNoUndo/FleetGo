import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

// Created on first use, so `next build` works even when DATABASE_URL is only
// available at runtime.
const g = globalThis as unknown as { __roadlineDb?: DB };

function connect(): DB {
  if (g.__roadlineDb) return g.__roadlineDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL nije podešen. Pogledaj README i .env.example.");
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const pool = new Pool({
    connectionString: url,
    // Encrypt traffic to Supabase; its pooler uses Supabase's own CA.
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    // A request never waits forever on a dead connection.
    query_timeout: 20_000,
  });
  // On Vercel, closes idle connections before the function is suspended so the
  // next request never reuses a stale socket. No-op elsewhere.
  attachDatabasePool(pool);
  g.__roadlineDb = drizzle({ client: pool, schema });
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
