import type { Metadata } from "next";
import { and, desc, eq, gt } from "drizzle-orm";
import { KeyRound, MonitorSmartphone, UserRound } from "lucide-react";
import { db, schema } from "@/db";
import { PageHeader, Shell } from "@/components/ui/primitives";
import { PasswordForm, SessionsList } from "@/components/profile-forms";
import { requireContext } from "@/lib/auth/context";
import { currentSessionId } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/permissions";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, relTime } from "@/lib/format";

export const metadata: Metadata = { title: "Profil" };

/** "Chrome · Windows" from a user-agent string; good enough to recognise a device. */
function device(ua: string | null): { browser: string; os: string; mobile: boolean } {
  if (!ua) return { browser: "—", os: "", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Brave/.test(ua) ? "Brave" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Pregledač";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { browser, os, mobile: /Mobi|iPhone|Android/.test(ua) };
}

export default async function ProfilePage() {
  const ctx = await requireContext();
  const [{ locale }, current] = await Promise.all([getPrefs(), currentSessionId()]);
  const sr = locale === "sr";
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, ctx.user.id), eq(schema.sessions.kind, "user"), gt(schema.sessions.expiresAt, new Date())))
    .orderBy(desc(schema.sessions.lastSeenAt), desc(schema.sessions.createdAt));
  const sessions = rows.map((r) => ({
    id: r.id,
    ...device(r.userAgent),
    current: r.id === current,
    admin: !!r.impersonatedBy,
    when: `${sr ? "Prijava" : "Signed in"} ${fmtDate(r.createdAt, locale)} · ${sr ? "aktivno" : "active"} ${relTime((r.lastSeenAt ?? r.createdAt).getTime(), locale)}`,
  }));
  const roleLabel = ROLES.find((r) => r.value === ctx.membership.role)?.label[locale] ?? ctx.membership.role;

  return (
    <>
      <PageHeader title={sr ? "Profil i bezbednost" : "Profile & security"} sub={sr ? "Tvoj nalog, lozinka i uređaji na kojima si prijavljen." : "Your account, password and signed-in devices."} />
      <div className="grid max-w-[880px] gap-6">
        <Shell icon={<UserRound />} title={sr ? "Nalog" : "Account"}>
          <dl className="grid gap-4 px-5 py-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-3">Email</dt>
              <dd className="mt-1 truncate font-medium">{ctx.user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">{sr ? "Firma" : "Company"}</dt>
              <dd className="mt-1 truncate font-medium">{ctx.company.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">{sr ? "Uloga" : "Role"}</dt>
              <dd className="mt-1 font-medium">{roleLabel}</dd>
            </div>
          </dl>
        </Shell>

        <Shell icon={<KeyRound />} title={sr ? "Promena lozinke" : "Change password"}>
          <div className="px-5 py-5">
            <PasswordForm disabled={ctx.impersonating} />
          </div>
        </Shell>

        <Shell icon={<MonitorSmartphone />} title={sr ? "Aktivne prijave" : "Active sessions"}>
          <SessionsList sessions={sessions} disabled={ctx.impersonating} />
        </Shell>
      </div>
    </>
  );
}
