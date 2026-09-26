import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { newToken, sha256 } from "./crypto";

/** Find a user by email or create one without a password (they set it from a link). */
export async function ensureUser(email: string, name?: string | null) {
  const e = email.trim().toLowerCase();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, e)).limit(1);
  if (existing) {
    if (name && !existing.name) await db.update(schema.users).set({ name }).where(eq(schema.users.id, existing.id));
    return { user: existing, created: false };
  }
  const [user] = await db.insert(schema.users).values({ email: e, name: name || null }).returning();
  return { user, created: true };
}

/** One-time link for setting a password; valid 7 days. Returns a path like /set-password?token=… */
export async function createPasswordLink(userId: string, days = 7) {
  const token = newToken();
  await db.insert(schema.authTokens).values({
    id: sha256(token),
    userId,
    purpose: "set_password",
    expiresAt: new Date(Date.now() + days * 86400000),
  });
  return `/set-password?token=${token}`;
}
