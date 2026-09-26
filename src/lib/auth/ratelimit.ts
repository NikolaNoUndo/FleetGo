import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const MAX_ATTEMPTS = 8;
export const WINDOW_MIN = 15;

/** Too many failed sign-ins for this key (email or "admin") in the last 15 minutes. */
export async function tooManyAttempts(key: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.key, key), eq(schema.loginAttempts.ok, false), gt(schema.loginAttempts.createdAt, new Date(Date.now() - WINDOW_MIN * 60000))));
  return (row?.n ?? 0) >= MAX_ATTEMPTS;
}
export async function recordAttempt(key: string, ok: boolean) {
  await db.insert(schema.loginAttempts).values({ key, ok });
  if (ok) await db.delete(schema.loginAttempts).where(and(eq(schema.loginAttempts.key, key), eq(schema.loginAttempts.ok, false)));
}

