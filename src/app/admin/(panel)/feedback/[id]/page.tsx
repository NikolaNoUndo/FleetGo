import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, count, desc, eq, ne, or } from "drizzle-orm";
import { ArrowLeft, Building2, MessageSquareText, User } from "lucide-react";
import Link from "@/components/ui/link";
import { db, schema } from "@/db";
import { Badge, Kv, PageHeader, Shell, StatusDot } from "@/components/ui/primitives";
import { FeedbackActions, MarkReadOnOpen } from "@/components/admin-feedback";
import { ROLES } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Utisak · Admin" };

const dt = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "—");
const short = (d: Date) => new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "short", year: "numeric" }).format(d);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One user's note in full: who sent it, from which company and page, and what else they sent. */
export default async function FeedbackPage(props: PageProps<"/admin/feedback/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const F = schema.feedback;
  const [f] = await db.select().from(F).where(eq(F.id, id)).limit(1);
  if (!f) notFound();

  const [user] = f.userId ? await db.select().from(schema.users).where(eq(schema.users.id, f.userId)).limit(1) : [];
  const [company] = f.companyId ? await db.select().from(schema.companies).where(eq(schema.companies.id, f.companyId)).limit(1) : [];
  const [membership] =
    f.userId && f.companyId
      ? await db.select({ role: schema.memberships.role }).from(schema.memberships).where(and(eq(schema.memberships.userId, f.userId), eq(schema.memberships.companyId, f.companyId))).limit(1)
      : [];
  const [vehicles] = f.companyId ? await db.select({ n: count() }).from(schema.vehicles).where(eq(schema.vehicles.companyId, f.companyId)) : [];
  const sameSource = [f.userId && eq(F.userId, f.userId), f.companyId && eq(F.companyId, f.companyId)].filter((x) => !!x);
  const others = sameSource.length ? await db.select().from(F).where(and(ne(F.id, f.id), or(...sameSource))).orderBy(desc(F.createdAt)).limit(20) : [];

  const companyName = company?.name ?? f.companyName ?? "—";
  const email = user?.email ?? f.userEmail;
  const role = ROLES.find((r) => r.value === membership?.role)?.label.sr ?? membership?.role;

  return (
    <>
      <MarkReadOnOpen id={f.id} read={!!f.readAt} />
      <Link href="/admin?tab=feedback" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Svi utisci
      </Link>
      <PageHeader title={`Utisak · ${companyName}`} sub={dt(f.createdAt)} actions={<FeedbackActions id={f.id} read={!!f.readAt} email={email} />} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Shell icon={<MessageSquareText />} title="Poruka" action={f.readAt ? <StatusDot tone="neutral">Pročitano</StatusDot> : <Badge tone="accent">Novo</Badge>}>
            <p className="px-4 pt-1 pb-5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{f.message}</p>
          </Shell>

          <Shell title={`Ostali utisci od ${email ?? companyName}`} action={<span>{others.length}</span>}>
            {others.length === 0 ? (
              <p className="px-4 pt-1 pb-5 text-sm text-ink-3">Ovo je prvi utisak iz ove firme.</p>
            ) : (
              <ul className="divide-y divide-line/70 border-t border-line/70">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/feedback/${o.id}`} className="flex gap-4 px-4 py-3 hover:bg-surface-2">
                      <span className="w-24 shrink-0 text-xs text-ink-3 tnum">{short(o.createdAt)}</span>
                      <span className={o.readAt ? "line-clamp-2 min-w-0 flex-1 text-sm text-ink-2" : "line-clamp-2 min-w-0 flex-1 text-sm font-medium text-ink"}>{o.message}</span>
                      {o.userEmail && o.userEmail !== email && <span className="hidden shrink-0 text-xs text-ink-3 sm:block">{o.userEmail}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Shell>
        </div>

        <div className="flex flex-col gap-4">
          <Shell icon={<User />} title="Ko je poslao">
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label="Email">{email ? <a href={`mailto:${email}`} className="break-all text-accent hover:underline">{email}</a> : "—"}</Kv>
              {user?.name && <Kv label="Ime">{user.name}</Kv>}
              <Kv label="Uloga">{role ?? "—"}</Kv>
              <Kv label="Poslednja prijava">{dt(user?.lastLoginAt)}</Kv>
              <Kv label="Bio je na">{f.page ? <code className="rounded bg-surface-3 px-1.5 py-0.5 text-xs">{f.page}</code> : "—"}</Kv>
            </div>
          </Shell>
          <Shell icon={<Building2 />} title="Firma">
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label="Naziv">{companyName}</Kv>
              {company ? (
                <>
                  <Kv label="Status">{company.status === "active" ? <StatusDot tone="good">Aktivna</StatusDot> : <StatusDot tone="bad">Blokirana</StatusDot>}</Kv>
                  <Kv label="Vozila">{vehicles?.n ?? 0}</Kv>
                  <Kv label="Koristi od">{short(company.createdAt)}</Kv>
                </>
              ) : (
                <Kv label="Status">Firma više ne postoji</Kv>
              )}
            </div>
          </Shell>
        </div>
      </div>
    </>
  );
}
