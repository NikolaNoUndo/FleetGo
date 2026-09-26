import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { newToken, sha256 } from "./crypto";

export const USER_COOKIE = "rl_session";
export const ADMIN_COOKIE = "rl_admin";
const USER_DAYS = 30;
const ADMIN_HOURS = 12;

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** Creates a user session and sets the cookie. Call only from server actions / route handlers. */
export async function startUserSession(userId: string, companyId: string | null, impersonatedBy: string | null = null) {
  const token = newToken();
  const maxAge = impersonatedBy ? 2 * 3600 : USER_DAYS * 86400;
  await db.insert(schema.sessions).values({
    id: sha256(token),
    kind: "user",
    userId,
    companyId,
    impersonatedBy,
    expiresAt: new Date(Date.now() + maxAge * 1000),
  });
  (await cookies()).set(USER_COOKIE, token, cookieOpts(maxAge));
  // opportunistic cleanup of expired sessions
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}

export async function endUserSession() {
  const c = await cookies();
  const token = c.get(USER_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  c.delete(USER_COOKIE);
}

export async function setSessionCompany(companyId: string) {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return;
  await db.update(schema.sessions).set({ companyId }).where(eq(schema.sessions.id, sha256(token)));
}

/** Current user session with its user row, or null. Cached per request. */
export const getUserSession = cache(async () => {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), eq(schema.sessions.kind, "user"), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  if (row.user.status !== "active" && !row.session.impersonatedBy) return null;
  return row;
});

/* ----------------------------- admin ----------------------------- */

export async function startAdminSession() {
  const token = newToken();
  const maxAge = ADMIN_HOURS * 3600;
  await db.insert(schema.sessions).values({ id: sha256(token), kind: "admin", expiresAt: new Date(Date.now() + maxAge * 1000) });
  (await cookies()).set(ADMIN_COOKIE, token, cookieOpts(maxAge));
}

export async function endAdminSession() {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  c.delete(ADMIN_COOKIE);
}

export const isAdmin = cache(async () => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [row] = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sha256(token)), eq(schema.sessions.kind, "admin"), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return !!row;
});
