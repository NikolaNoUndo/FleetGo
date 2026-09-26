import type { Metadata } from "next";
import { Building2, KeyRound, SatelliteDish } from "lucide-react";
import { Badge, PageHeader, Shell } from "@/components/ui/primitives";
import { CompanyForm, TelematicsTest } from "@/components/settings-forms";
import { getT } from "@/lib/prefs";
import { getCompany } from "@/lib/tenant";
import { telematicsMode } from "@/lib/telematics";

export const metadata: Metadata = { title: "Podešavanja" };

export default async function SettingsPage() {
  const [t, company] = await Promise.all([getT(), getCompany()]);
  const mode = telematicsMode();
  return (
    <>
      <PageHeader title={t("p.settings.title")} sub={t("p.settings.sub")} />
      <div className="grid max-w-[880px] gap-5">
        <Shell icon={<Building2 />} title={t("s.company")}>
          <CompanyForm
            initial={{
              name: company.name,
              pib: company.pib ?? "",
              address: company.address ?? "",
              eurRsdRate: String(company.eurRsdRate),
              warnDays: String(company.warnDays),
            }}
          />
        </Shell>

        <Shell
          icon={<SatelliteDish />}
          title={t("s.wialon")}
          action={<Badge tone={mode === "wialon" ? "good" : "neutral"}>{mode === "wialon" ? t("s.wialonOn") : t("s.wialonOff")}</Badge>}
        >
          <div className="space-y-4 px-4 py-4">
            <p className="text-sm leading-relaxed text-ink-2">{t("s.wialonHow")}</p>
            <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-xs text-ink-2">
              {`WIALON_TOKEN=tvoj_token\n# opciono, za Wialon Local:\nWIALON_HOST=https://hst-api.wialon.com`}
            </pre>
            <TelematicsTest />
          </div>
        </Shell>

        <Shell icon={<KeyRound />} title={t("s.access")}>
          <p className="px-4 py-4 text-sm leading-relaxed text-ink-2">{t("s.accessHint")}</p>
        </Shell>
      </div>
    </>
  );
}
