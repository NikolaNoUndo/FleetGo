import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Building2, SatelliteDish, Users } from "lucide-react";
import { Badge, PageHeader, Shell } from "@/components/ui/primitives";
import { CompanyForm, TelematicsTest } from "@/components/settings-forms";
import { MembersManager } from "@/components/members";
import { getPrefs, getT } from "@/lib/prefs";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { telematicsMode } from "@/lib/telematics";
import { getNbsRate } from "@/lib/fx";
import { db, schema } from "@/db";

export const metadata: Metadata = { title: "Podešavanja" };

export default async function SettingsPage() {
  const ctx = await requireAccess("settings");
  const [t, nbs, { locale }] = await Promise.all([getT(), getNbsRate(), getPrefs()]);
  const company = ctx.company;
  const mode = telematicsMode();
  const sr = locale === "sr";

  const members = ctx.isOwner
    ? await db
        .select({ m: schema.memberships, u: schema.users })
        .from(schema.memberships)
        .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
        .where(eq(schema.memberships.companyId, company.id))
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
              eurRsdRate: String(company.eurRsdRate),
              warnDays: String(company.warnDays),
              rateMode: company.rateMode,
            }}
          />
        </Shell>

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

        {can(ctx.perms, "live") && <Shell
          icon={<SatelliteDish />}
          title={t("s.wialon")}
          action={<Badge tone={mode === "wialon" ? "good" : "neutral"}>{mode === "wialon" ? t("s.wialonOn") : t("s.wialonOff")}</Badge>}
        >
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-relaxed text-ink-2">{t("s.wialonHow")}</p>
            <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-xs text-ink-2">
              {`WIALON_TOKEN=tvoj_token\n# opciono, za Wialon Local:\nWIALON_HOST=https://hst-api.wialon.com`}
            </pre>
            <TelematicsTest />
          </div>
        </Shell>}
      </div>
    </>
  );
}
