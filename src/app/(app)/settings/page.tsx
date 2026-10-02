import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { Building2, FileSpreadsheet, LifeBuoy, SatelliteDish, Users } from "lucide-react";
import { Badge, PageHeader, Shell } from "@/components/ui/primitives";
import { CompanyForm, SupportAccess, TelematicsSettings } from "@/components/settings-forms";
import { MembersManager } from "@/components/members";
import { FleetImportPanel } from "@/components/fleet-import";
import { getPrefs, getT } from "@/lib/prefs";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getNbsRate } from "@/lib/fx";
import { db, schema } from "@/db";

export const metadata: Metadata = { title: "Podešavanja" };

export default async function SettingsPage() {
  const ctx = await requireAccess("settings");
  const [t, nbs, { locale }] = await Promise.all([getT(), getNbsRate(), getPrefs()]);
  const company = ctx.company;
  const hasToken = !!company.wialonToken;
  const sr = locale === "sr";

  const members = ctx.isOwner
    ? await db
        .select({ m: schema.memberships, u: schema.users })
        .from(schema.memberships)
        .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
        .where(eq(schema.memberships.companyId, company.id))
    : [];

  const visits = ctx.isOwner
    ? await db
        .select({ at: schema.auditLog.createdAt })
        .from(schema.auditLog)
        .where(and(eq(schema.auditLog.companyId, company.id), eq(schema.auditLog.action, "impersonate.start")))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(10)
    : [];

  return (
    <>
      <PageHeader title={t("p.settings.title")} sub={t("p.settings.sub")} />
      <div className="grid max-w-[920px] gap-6">
        <Shell icon={<Building2 />} title={t("s.company")}>
          <CompanyForm
            readOnly={!can(ctx.perms, "settings", "edit")}
            nbs={nbs}
            initial={{
              name: company.name,
              pib: company.pib ?? "",
              address: company.address ?? "",
              hqLocation: company.hqLat !== null && company.hqLng !== null ? `${company.hqLat}, ${company.hqLng}` : "",
              eurRsdRate: String(company.eurRsdRate),
              warnDays: String(company.warnDays),
              rateMode: company.rateMode,
            }}
          />
        </Shell>

        {(["vehicles", "trailers", "employees"] as const).some((m) => can(ctx.perms, m, "edit")) && (
          <Shell icon={<FileSpreadsheet />} title={sr ? "Uvoz iz Excela" : "Import from Excel"}>
            <FleetImportPanel />
          </Shell>
        )}

        {ctx.isOwner && (
          <Shell icon={<Users />} title={sr ? "Članovi" : "Members"} action={<span>{sr ? "Samo vlasnik vidi ovaj deo" : "Only owners see this"}</span>}>
            <MembersManager
              members={members.map(({ m, u }) => ({
                id: m.id,
                email: u.email,
                name: u.name,
                role: m.role,
                permissions: m.permissions,
                hasPassword: !!u.passwordHash,
                lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
                isSelf: u.id === ctx.user.id,
              }))}
            />
          </Shell>
        )}

        {ctx.isOwner && !ctx.impersonating && (
          <Shell icon={<LifeBuoy />} title={sr ? "Pristup podrške" : "Support access"} action={<span>{sr ? "Samo vlasnik vidi ovaj deo" : "Only owners see this"}</span>}>
            <SupportAccess
              until={company.supportAccessUntil && company.supportAccessUntil > new Date() ? company.supportAccessUntil.toISOString() : null}
              visits={visits.map((v) => v.at.toISOString())}
            />
          </Shell>
        )}

        {can(ctx.perms, "live") && <Shell
          icon={<SatelliteDish />}
          title={t("s.wialon")}
          action={<Badge tone={hasToken ? "good" : "neutral"}>{hasToken ? t("s.wialonOn") : t("s.wialonOff")}</Badge>}
        >
          <div className="px-5 py-5">
            <TelematicsSettings
              hasToken={hasToken}
              hint={company.wialonToken ? company.wialonToken.slice(-4) : null}
              host={company.wialonHost}
              canEdit={can(ctx.perms, "settings", "edit")}
            />
          </div>
        </Shell>}
      </div>
    </>
  );
}
