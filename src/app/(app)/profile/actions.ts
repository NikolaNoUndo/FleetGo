"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { currentSessionId, getUserSession } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { recordAttempt, tooManyAttempts } from "@/lib/auth/ratelimit";

export type ProfileResult = { ok: true } | { ok: false; error: "session" | "admin" | "current" | "short" | "match" | "same" | "limit" };

/** Changes the signed-in user's password and signs out every other device. */
export async function changePassword(input: { current: string; next: string; confirm: string }): Promise<ProfileResult> {
  const s = await getUserSession();
  if (!s) return { ok: false, error: "session" };
  if (s.session.impersonatedBy) return { ok: false, error: "admin" };
  const key = `pw:${s.user.id}`;
  if (await tooManyAttempts(key)) return { ok: false, error: "limit" };
  const next = String(input.next ?? "");
  if (next.length < 8) return { ok: false, error: "short" };
  if (next !== String(input.confirm ?? "")) return { ok: false, error: "match" };
  const ok = await verifyPassword(String(input.current ?? ""), s.user.passwordHash);
  await recordAttempt(key, ok);
  if (!ok) return { ok: false, error: "current" };
  if (next === input.current) return { ok: false, error: "same" };

  await db.update(schema.users).set({ passwordHash: await hashPassword(next), mustChangePassword: false }).where(eq(schema.users.id, s.user.id));
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, s.user.id), ne(schema.sessions.id, s.session.id)));
  await audit(s.user.email, "password.changed", {});
  revalidatePath("/profile");
  return { ok: true };
}

/** Signs out one of the user's own sessions (another device). */
export async function signOutSession(id: string): Promise<{ ok: boolean }> {
  const s = await getUserSession();
  if (!s || s.session.impersonatedBy) return { ok: false };
  if (id === (await currentSessionId())) return { ok: false };
  await db.delete(schema.sessions).where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, s.user.id), eq(schema.sessions.kind, "user")));
  await audit(s.user.email, "session.revoked", {});
  revalidatePath("/profile");
  return { ok: true };
}

/** Signs out every device except this one. */
export async function signOutOthers(): Promise<{ ok: boolean }> {
  const s = await getUserSession();
  if (!s || s.session.impersonatedBy) return { ok: false };
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, s.user.id), ne(schema.sessions.id, s.session.id)));
  await audit(s.user.email, "session.revoked_others", {});
  revalidatePath("/profile");
  return { ok: true };
}
