"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { endAdminSession, endUserSession, getUserSession, isAdmin, startAdminSession, startUserSession } from "@/lib/auth/session";
import { createPasswordLink, ensureUser } from "@/lib/auth/users";
import { isRole, ROLE_PRESETS, type Role } from "@/lib/auth/permissions";
import { recordAttempt, tooManyAttempts, WINDOW_MIN } from "@/lib/auth/ratelimit";
import { audit } from "@/lib/auth/audit";

export type AdminResult = { ok: true; link?: string | null; password?: string; id?: string } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard() {
  if (!(await isAdmin())) throw new Error("Admin only");
}

export async function adminLogin(_: { error?: string; username?: string } | null, form: FormData): Promise<{ error?: string; username?: string } | null> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUser || !expectedHash) return { error: "Admin pristup nije podešen (ADMIN_USERNAME / ADMIN_PASSWORD_HASH)." };
  if (await tooManyAttempts("admin")) return { error: `Previše pokušaja. Pokušaj ponovo za ${WINDOW_MIN} minuta.` };
  const ok = username.toLowerCase() === expectedUser.trim().toLowerCase() && (await verifyPassword(password, expectedHash));
  await recordAttempt("admin", ok);
  if (!ok) {
    await audit("admin", "admin.login.failed", { username });
    return { error: "Pogrešno korisničko ime ili lozinka.", username };
  }
  await startAdminSession();
  await audit("admin", "admin.login");
  redirect("/admin");
}

export async function adminLogout() {
  await endAdminSession();
  redirect("/admin/login");
}

/** Creates a company with its first owner. Shared by "approve request" and "new company". */
async function createCompanyWithOwner(input: { name: string; pib?: string | null; address?: string | null; email: string; ownerName?: string | null }) {
  const [company] = await db
    .insert(schema.companies)
    .values({ name: input.name, pib: input.pib || null, address: input.address || null })
    .returning();
  const { user } = await ensureUser(input.email, input.ownerName);
  await db.insert(schema.memberships).values({ userId: user.id, companyId: company.id, role: "owner", permissions: ROLE_PRESETS.owner });
  const link = user.passwordHash ? null : await createPasswordLink(user.id);
  return { company, user, link };
}

export async function approveRequest(id: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(id)) return { ok: false, error: "bad" };
  const [r] = await db.select().from(schema.registrationRequests).where(eq(schema.registrationRequests.id, id)).limit(1);
  if (!r || r.status !== "pending") return { ok: false, error: "notfound" };
  const { company, link } = await createCompanyWithOwner({ name: r.companyName, pib: r.pib, email: r.email, ownerName: r.contactName });
  await db.update(schema.registrationRequests).set({ status: "approved", companyId: company.id, handledAt: new Date() }).where(eq(schema.registrationRequests.id, id));
  await audit("admin", "request.approved", { company: company.name, email: r.email }, company.id);
  revalidatePath("/admin");
  return { ok: true, link, id: company.id };
}

export async function rejectRequest(id: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(id)) return { ok: false, error: "bad" };
  await db.update(schema.registrationRequests).set({ status: "rejected", handledAt: new Date() }).where(eq(schema.registrationRequests.id, id));
  await audit("admin", "request.rejected", { id });
  revalidatePath("/admin");
  return { ok: true };
}

export async function createCompany(input: { name: string; pib: string; address: string; email: string; ownerName: string }): Promise<AdminResult> {
  await guard();
  if (!input.name?.trim()) return { ok: false, error: "name" };
  if (!EMAIL.test(input.email?.trim() ?? "")) return { ok: false, error: "email" };
  const { company, link } = await createCompanyWithOwner({
    name: input.name.trim(),
    pib: input.pib?.trim(),
    address: input.address?.trim(),
    email: input.email,
    ownerName: input.ownerName?.trim(),
  });
  await audit("admin", "company.created", { company: company.name, owner: input.email.trim().toLowerCase() }, company.id);
  revalidatePath("/admin");
  return { ok: true, link, id: company.id };
}

export async function addCompanyMember(companyId: string, input: { email: string; name: string; role: string }): Promise<AdminResult> {
  await guard();
  if (!UUID.test(companyId) || !EMAIL.test(input.email?.trim() ?? "") || !isRole(input.role)) return { ok: false, error: "bad" };
  const { user } = await ensureUser(input.email, input.name?.trim());
  const role = input.role as Role;
  await db
    .insert(schema.memberships)
    .values({ userId: user.id, companyId, role, permissions: ROLE_PRESETS[role] })
    .onConflictDoUpdate({ target: [schema.memberships.userId, schema.memberships.companyId], set: { role, permissions: ROLE_PRESETS[role], status: "active" } });
  const link = user.passwordHash ? null : await createPasswordLink(user.id);
  await audit("admin", "member.added", { email: user.email, role }, companyId);
  revalidatePath("/admin");
  return { ok: true, link };
}

export async function setCompanyStatus(companyId: string, status: "active" | "blocked"): Promise<AdminResult> {
  await guard();
  if (!UUID.test(companyId)) return { ok: false, error: "bad" };
  await db.update(schema.companies).set({ status }).where(eq(schema.companies.id, companyId));
  if (status === "blocked") await db.delete(schema.sessions).where(and(eq(schema.sessions.companyId, companyId), eq(schema.sessions.kind, "user")));
  await audit("admin", `company.${status}`, {}, companyId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserStatus(userId: string, status: "active" | "blocked"): Promise<AdminResult> {
  await guard();
  if (!UUID.test(userId)) return { ok: false, error: "bad" };
  const [u] = await db.update(schema.users).set({ status }).where(eq(schema.users.id, userId)).returning();
  if (status === "blocked") await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await audit("admin", `user.${status}`, { email: u?.email });
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Removes a blocked user for good: their sign-in, memberships and sessions. Company data
 * stays; their feedback notes stay without the link to them. Only after blocking.
 */
export async function deleteUser(userId: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(userId)) return { ok: false, error: "bad" };
  const [u] = await db.select({ email: schema.users.email, status: schema.users.status }).from(schema.users).where(eq(schema.users.id, userId));
  if (!u) return { ok: false, error: "Korisnik ne postoji." };
  if (u.status !== "blocked") return { ok: false, error: "Prvo blokiraj korisnika, pa ga onda ukloni." };
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  await audit("admin", "user.deleted", { email: u.email });
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminPasswordLink(userId: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(userId)) return { ok: false, error: "bad" };
  const link = await createPasswordLink(userId);
  const [u] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
  await audit("admin", "user.password-link", { email: u?.email });
  return { ok: true, link };
}

/** Readable temporary password; the person must change it at next sign-in. */
export async function adminTempPassword(userId: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(userId)) return { ok: false, error: "bad" };
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const password = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const [u] = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: true })
    .where(eq(schema.users.id, userId))
    .returning();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await audit("admin", "user.temp-password", { email: u?.email });
  return { ok: true, password };
}

/**
 * Open the app as this user, in this company. Only while the company's owner has
 * allowed support access (Settings → Pristup podrške, 24 h). Logged, max 2 hours.
 */
export async function impersonate(userId: string, companyId: string) {
  await guard();
  if (!UUID.test(userId) || !UUID.test(companyId)) return;
  const [c] = await db.select({ until: schema.companies.supportAccessUntil }).from(schema.companies).where(eq(schema.companies.id, companyId)).limit(1);
  if (!c?.until || c.until <= new Date()) return;
  const [m] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.companyId, companyId)))
    .limit(1);
  if (!m) return;
  const [u] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
  await startUserSession(userId, companyId, "admin");
  await audit("admin", "impersonate.start", { email: u?.email }, companyId);
  redirect("/");
}

export async function stopImpersonation() {
  const s = await getUserSession();
  if (!s?.session.impersonatedBy) redirect("/");
  await endUserSession();
  await audit("admin", "impersonate.stop");
  redirect("/admin");
}

/** Marks a user's note as read (or back to unread). */
export async function setFeedbackRead(id: string, read: boolean): Promise<AdminResult> {
  await guard();
  if (!UUID.test(id)) return { ok: false, error: "id" };
  await db.update(schema.feedback).set({ readAt: read ? new Date() : null }).where(eq(schema.feedback.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

/** Deletes a user's note for good. */
export async function deleteFeedback(id: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(id)) return { ok: false, error: "id" };
  await db.delete(schema.feedback).where(eq(schema.feedback.id, id));
  await audit("admin", "feedback.deleted", { id });
  revalidatePath("/admin");
  return { ok: true };
}

/* ---------- Izmene i ideje (admin's own notes) ---------- */

const NOTE_KINDS = ["change", "idea"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function addNote(kind: "change" | "idea", text: string, date?: string): Promise<AdminResult> {
  await guard();
  const body = text.trim().slice(0, 4000);
  if (!NOTE_KINDS.includes(kind) || !body) return { ok: false, error: "Upiši tekst." };
  if (kind === "change" && (!date || !ISO.test(date))) return { ok: false, error: "Izaberi datum." };
  await db.insert(schema.adminNotes).values({ kind, text: body, date: kind === "change" ? date : null, source: "manual" });
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateNote(id: string, patch: { text?: string; date?: string; done?: boolean }): Promise<AdminResult> {
  await guard();
  if (!UUID.test(id)) return { ok: false, error: "id" };
  const set: Partial<typeof schema.adminNotes.$inferInsert> = { updatedAt: new Date() };
  if (patch.text !== undefined) {
    const body = patch.text.trim().slice(0, 4000);
    if (!body) return { ok: false, error: "Upiši tekst." };
    set.text = body;
  }
  if (patch.date !== undefined) {
    if (!ISO.test(patch.date)) return { ok: false, error: "Izaberi datum." };
    set.date = patch.date;
  }
  if (patch.done !== undefined) set.done = patch.done;
  await db.update(schema.adminNotes).set(set).where(eq(schema.adminNotes.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

/** Removes a note; one that came with the code stays as a hidden marker so it isn't copied in again. */
export async function deleteNote(id: string): Promise<AdminResult> {
  await guard();
  if (!UUID.test(id)) return { ok: false, error: "id" };
  const N = schema.adminNotes;
  const [n] = await db.select({ key: N.key }).from(N).where(eq(N.id, id)).limit(1);
  if (n?.key) await db.update(N).set({ deletedAt: new Date() }).where(eq(N.id, id));
  else await db.delete(N).where(eq(N.id, id));
  revalidatePath("/admin");
  return { ok: true };
}
