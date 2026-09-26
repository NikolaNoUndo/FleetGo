"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, sha256, verifyPassword } from "@/lib/auth/crypto";
import { endUserSession, getUserSession, setSessionCompany, startUserSession } from "@/lib/auth/session";
import { userCompanies } from "@/lib/auth/context";
import { audit } from "@/lib/auth/audit";
import { recordAttempt, tooManyAttempts, WINDOW_MIN } from "@/lib/auth/ratelimit";

export type FormState = { error?: string; ok?: boolean; fields?: Record<string, string> } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const sr = String(form.get("locale") ?? "sr") !== "en";
  if (!EMAIL.test(email) || !password) return { error: sr ? "Unesi email i lozinku." : "Enter your email and password.", fields: { email } };
  if (await tooManyAttempts(email))
    return { error: sr ? `Previše pokušaja. Pokušaj ponovo za ${WINDOW_MIN} minuta.` : `Too many attempts. Try again in ${WINDOW_MIN} minutes.`, fields: { email } };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = !!user && (await verifyPassword(password, user.passwordHash));
  await recordAttempt(email, ok);
  if (!ok || !user) return { error: sr ? "Pogrešan email ili lozinka." : "Wrong email or password.", fields: { email } };
  if (user.status !== "active") return { error: sr ? "Nalog je blokiran. Javi se administratoru." : "This account is blocked.", fields: { email } };

  const companies = (await userCompanies(user.id)).filter((c) => c.status === "active");
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await startUserSession(user.id, companies.length === 1 ? companies[0].id : null);
  await audit(email, "login", { companies: companies.length }, companies.length === 1 ? companies[0].id : null);

  if (user.mustChangePassword) redirect("/set-password");
  if (companies.length === 1) redirect("/");
  redirect("/select-company");
}

export async function logout() {
  await endUserSession();
  redirect("/login");
}

export async function selectCompany(companyId: string) {
  const s = await getUserSession();
  if (!s) redirect("/login");
  const companies = (await userCompanies(s.user.id)).filter((c) => c.status === "active" || s.session.impersonatedBy);
  if (!companies.some((c) => c.id === companyId)) return;
  await setSessionCompany(companyId);
  redirect("/");
}

export async function requestAccess(_: FormState, form: FormData): Promise<FormState> {
  const sr = String(form.get("locale") ?? "sr") !== "en";
  const v = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const fields = { companyName: v("companyName"), pib: v("pib", 20), contactName: v("contactName"), email: v("email").toLowerCase(), phone: v("phone", 40), fleetSize: v("fleetSize", 20), message: v("message", 1000) };
  if (!fields.companyName || !fields.contactName || !EMAIL.test(fields.email))
    return { error: sr ? "Popuni naziv firme, ime i ispravan email." : "Fill in company name, your name and a valid email.", fields };
  // basic flood guard: max 3 open requests per email
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.registrationRequests)
    .where(and(eq(schema.registrationRequests.email, fields.email), eq(schema.registrationRequests.status, "pending")));
  if ((row?.n ?? 0) >= 3) return { ok: true };
  await db.insert(schema.registrationRequests).values({
    companyName: fields.companyName,
    pib: fields.pib || null,
    contactName: fields.contactName,
    email: fields.email,
    phone: fields.phone || null,
    fleetSize: fields.fleetSize || null,
    message: fields.message || null,
  });
  await audit(fields.email, "request.created", { company: fields.companyName });
  return { ok: true };
}

/**
 * Sets a password either from a one-time link (?token=...) or, for a signed-in user
 * who was given a temporary password, from the forced-change screen.
 */
export async function setPassword(_: FormState, form: FormData): Promise<FormState> {
  const sr = String(form.get("locale") ?? "sr") !== "en";
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: sr ? "Lozinka mora imati najmanje 8 znakova." : "Password must be at least 8 characters." };
  if (password !== confirm) return { error: sr ? "Lozinke se ne poklapaju." : "Passwords do not match." };

  let userId: string | null = null;
  if (token) {
    const [t] = await db
      .select()
      .from(schema.authTokens)
      .where(and(eq(schema.authTokens.id, sha256(token)), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
      .limit(1);
    if (!t) return { error: sr ? "Link je istekao ili je već iskorišćen. Zatraži novi." : "This link has expired or was already used." };
    userId = t.userId;
    await db.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, t.id));
  } else {
    const s = await getUserSession();
    if (!s) return { error: sr ? "Sesija je istekla, prijavi se ponovo." : "Session expired, sign in again." };
    userId = s.user.id;
  }

  const [user] = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: false, lastLoginAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  // sign out everywhere else, then start a fresh session here
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  const companies = (await userCompanies(userId)).filter((c) => c.status === "active");
  await startUserSession(userId, companies.length === 1 ? companies[0].id : null);
  await audit(user.email, "password.set", { via: token ? "link" : "forced-change" });
  redirect(companies.length === 1 ? "/" : "/select-company");
}
