"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/auth/context";
import { effectivePerms, isRole, MODULES, ROLE_PRESETS, type Access, type Role } from "@/lib/auth/permissions";
import { createPasswordLink, ensureUser } from "@/lib/auth/users";
import { audit } from "@/lib/auth/audit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownerContext() {
  const ctx = await getContext();
  if (!ctx || !ctx.isOwner) throw new Error("Only the owner can manage members");
  return ctx;
}

function cleanPerms(role: Role, raw: Record<string, string> | undefined) {
  const out: Record<string, Access> = { ...ROLE_PRESETS[role] };
  if (raw) for (const m of MODULES) if (raw[m.key] === "none" || raw[m.key] === "view" || raw[m.key] === "edit") out[m.key] = raw[m.key] as Access;
  return out;
}

async function ownerCount(companyId: string, exceptId?: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.companyId, companyId),
        eq(schema.memberships.role, "owner"),
        eq(schema.memberships.status, "active"),
        exceptId ? ne(schema.memberships.id, exceptId) : undefined,
      ),
    );
  return r?.n ?? 0;
}

export type MemberResult = { ok: true; link?: string | null } | { ok: false; error: string };

export async function addMember(input: { email: string; name: string; role: string; permissions?: Record<string, string> }): Promise<MemberResult> {
  const ctx = await ownerContext();
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "email" };
  if (!isRole(input.role)) return { ok: false, error: "role" };
  const { user } = await ensureUser(email, input.name?.trim() || null);
  const perms = cleanPerms(input.role, input.permissions);

  const [existing] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.companyId, ctx.company.id)))
    .limit(1);
  if (existing && existing.status === "active") return { ok: false, error: "exists" };
  if (existing) {
    await db.update(schema.memberships).set({ status: "active", role: input.role, permissions: perms }).where(eq(schema.memberships.id, existing.id));
  } else {
    await db.insert(schema.memberships).values({ userId: user.id, companyId: ctx.company.id, role: input.role, permissions: perms });
  }
  // A brand-new person gets a link to set their password; people who already have
  // an account (e.g. in another company) just see this company next time they sign in.
  const link = user.passwordHash ? null : await createPasswordLink(user.id);
  await audit(ctx.user.email, "member.added", { email, role: input.role }, ctx.company.id);
  revalidatePath("/settings");
  return { ok: true, link };
}

export async function updateMember(membershipId: string, input: { role: string; permissions?: Record<string, string> }): Promise<MemberResult> {
  const ctx = await ownerContext();
  if (!UUID.test(membershipId) || !isRole(input.role)) return { ok: false, error: "bad" };
  const [m] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.companyId, ctx.company.id)))
    .limit(1);
  if (!m) return { ok: false, error: "notfound" };
  if (m.role === "owner" && input.role !== "owner" && (await ownerCount(ctx.company.id, m.id)) === 0) return { ok: false, error: "last-owner" };
  await db
    .update(schema.memberships)
    .set({ role: input.role, permissions: cleanPerms(input.role, input.permissions) })
    .where(eq(schema.memberships.id, m.id));
  await audit(ctx.user.email, "member.updated", { membershipId, role: input.role, perms: effectivePerms(input.role, input.permissions as never) }, ctx.company.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMember(membershipId: string): Promise<MemberResult> {
  const ctx = await ownerContext();
  if (!UUID.test(membershipId)) return { ok: false, error: "bad" };
  const [m] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.companyId, ctx.company.id)))
    .limit(1);
  if (!m) return { ok: false, error: "notfound" };
  if (m.role === "owner" && (await ownerCount(ctx.company.id, m.id)) === 0) return { ok: false, error: "last-owner" };
  await db.delete(schema.memberships).where(eq(schema.memberships.id, m.id));
  // end their sessions in this company
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, m.userId), eq(schema.sessions.companyId, ctx.company.id)));
  await audit(ctx.user.email, "member.removed", { membershipId }, ctx.company.id);
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * New link for a member who has not set a password yet. Resetting the password of
 * someone who already has one is admin-only, because that account may belong to
 * other companies too.
 */
export async function memberLink(membershipId: string): Promise<MemberResult> {
  const ctx = await ownerContext();
  if (!UUID.test(membershipId)) return { ok: false, error: "bad" };
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.companyId, ctx.company.id)))
    .limit(1);
  if (!row) return { ok: false, error: "notfound" };
  if (row.user.passwordHash) return { ok: false, error: "has-password" };
  const link = await createPasswordLink(row.user.id);
  await audit(ctx.user.email, "member.link", { email: row.user.email }, ctx.company.id);
  return { ok: true, link };
}
