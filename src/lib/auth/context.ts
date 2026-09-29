import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUserSession } from "./session";
import { can, effectivePerms, type ModuleKey, type Perms } from "./permissions";

export type AppContext = {
  user: typeof schema.users.$inferSelect;
  company: typeof schema.companies.$inferSelect;
  membership: typeof schema.memberships.$inferSelect;
  perms: Perms;
  isOwner: boolean;
  impersonating: boolean;
  companies: { id: string; name: string; role: string }[];
};

/** All active companies this user belongs to. */
export async function userCompanies(userId: string) {
  return db
    .select({ id: schema.companies.id, name: schema.companies.name, role: schema.memberships.role, status: schema.companies.status })
    .from(schema.memberships)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.memberships.companyId))
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.status, "active")))
    .orderBy(asc(schema.companies.name));
}

/**
 * Who is asking and for which company. Returns null when not signed in or when
 * no company is selected / allowed. Cached per request.
 */
export const getContext = cache(async (): Promise<AppContext | null> => {
  const s = await getUserSession();
  if (!s || !s.session.companyId) return null;
  const [row] = await db
    .select({ company: schema.companies, membership: schema.memberships })
    .from(schema.memberships)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.memberships.companyId))
    .where(and(eq(schema.memberships.userId, s.user.id), eq(schema.memberships.companyId, s.session.companyId), eq(schema.memberships.status, "active")))
    .limit(1);
  if (!row) return null;
  const impersonating = !!s.session.impersonatedBy;
  if (row.company.status !== "active" && !impersonating) return null;
  // the admin only gets in while the owner's 24-hour support access is open
  if (impersonating && !(row.company.supportAccessUntil && row.company.supportAccessUntil > new Date())) return null;
  const companies = (await userCompanies(s.user.id)).filter((c) => c.status === "active" || impersonating);
  return {
    user: s.user,
    company: row.company,
    membership: row.membership,
    perms: effectivePerms(row.membership.role, row.membership.permissions),
    isOwner: row.membership.role === "owner",
    impersonating,
    companies,
  };
});

/** For pages: signed-in context or a redirect to the right auth screen. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (ctx) return ctx;
  const s = await getUserSession();
  if (!s) redirect("/login");
  if (s.user.mustChangePassword) redirect("/set-password");
  redirect("/select-company");
}

/** For pages: context plus a module check; shows the no-access screen otherwise. */
export async function requireAccess(module: ModuleKey, level: "view" | "edit" = "view"): Promise<AppContext> {
  const ctx = await requireContext();
  if (!can(ctx.perms, module, level)) redirect("/no-access");
  return ctx;
}

/** For server actions: throws instead of redirecting. */
export async function assertAccess(module: ModuleKey, level: "view" | "edit" = "edit"): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) throw new Error("Not signed in");
  if (!can(ctx.perms, module, level)) throw new Error("Forbidden");
  return ctx;
}
