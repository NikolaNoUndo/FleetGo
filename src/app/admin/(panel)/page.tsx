import type { Metadata } from "next";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { AdminPanel } from "@/components/admin-panel";
import { listNotes } from "@/lib/admin/notes";
import { networkStatus } from "@/lib/tolls/server";
import { rampStatus } from "@/lib/tolls/ramps-server";

export const metadata: Metadata = { title: "Admin" };
/** loading the toll network fetches OpenStreetMap tiles from server actions on this page */
export const maxDuration = 60;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const sp = await props.searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "requests";

  const [requests, companies, members, users, vehicleCounts, log, feedback, notes] = await Promise.all([
    db.select().from(schema.registrationRequests).orderBy(desc(schema.registrationRequests.createdAt)).limit(100),
    db.select().from(schema.companies).orderBy(desc(schema.companies.createdAt)),
    db
      .select({
        id: schema.memberships.id,
        userId: schema.memberships.userId,
        companyId: schema.memberships.companyId,
        role: schema.memberships.role,
        status: schema.memberships.status,
        email: schema.users.email,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId)),
    db.select().from(schema.users).orderBy(desc(schema.users.createdAt)),
    db.select({ companyId: schema.vehicles.companyId, n: sql<number>`count(*)::int` }).from(schema.vehicles).groupBy(schema.vehicles.companyId),
    // platform events only; what members do inside their company stays with the company
    db
      .select()
      .from(schema.auditLog)
      .where(or(eq(schema.auditLog.actor, "admin"), inArray(schema.auditLog.action, ["request.created", "support.granted", "support.revoked"])))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(200),
    db.select().from(schema.feedback).orderBy(desc(schema.feedback.createdAt)).limit(500),
    listNotes(),
  ]);
  const [tolls, ramps] = tab === "tolls" ? await Promise.all([networkStatus(), rampStatus()]) : [[], []];

  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const supportOpen = new Set(companies.filter((c) => c.supportAccessUntil && c.supportAccessUntil > new Date()).map((c) => c.id));
  const weekAgo = daysAgo(7);
  const activeWeek = users.filter((u) => u.lastLoginAt && u.lastLoginAt > weekAgo).length;
  return (
    <AdminPanel
      tab={tab}
      tolls={tolls}
      ramps={ramps}
      activeWeek={activeWeek}
      requests={requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), handledAt: r.handledAt?.toISOString() ?? null }))}
      companies={companies.map((c) => ({
        id: c.id,
        name: c.name,
        pib: c.pib,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        vehicles: vehicleCounts.find((v) => v.companyId === c.id)?.n ?? 0,
        supportUntil: c.supportAccessUntil && c.supportAccessUntil > new Date() ? c.supportAccessUntil.toISOString() : null,
        members: members.filter((m) => m.companyId === c.id).map((m) => ({ id: m.id, userId: m.userId, email: m.email, role: m.role })),
      }))}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        hasPassword: !!u.passwordHash,
        mustChange: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        memberships: members
          .filter((m) => m.userId === u.id)
          .map((m) => ({ companyId: m.companyId, company: companyName.get(m.companyId) ?? "—", role: m.role, support: supportOpen.has(m.companyId) })),
      }))}
      feedback={feedback.map((f) => ({ id: f.id, company: f.companyName, email: f.userEmail, message: f.message, page: f.page, readAt: f.readAt?.toISOString() ?? null, createdAt: f.createdAt.toISOString() }))}
      notes={notes.map((n) => ({ id: n.id, kind: n.kind, date: n.date, text: n.text, source: n.source, done: n.done, createdAt: n.createdAt.toISOString() }))}
      log={log.map((l) => ({ id: l.id, actor: l.actor, action: l.action, company: l.companyId ? (companyName.get(l.companyId) ?? null) : null, details: l.details, createdAt: l.createdAt.toISOString() }))}
    />
  );
}
