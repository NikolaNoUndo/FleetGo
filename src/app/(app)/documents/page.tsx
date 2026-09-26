import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/stat";
import { Distribution } from "@/components/distribution";
import { SectionTabs } from "@/components/topbar";
import { DocumentsTable } from "@/components/tables/records";
import { getPrefs, getT } from "@/lib/prefs";
import { documentsWithOwner, getRefs } from "@/lib/queries";
import { getMoney } from "@/lib/money-server";
import { expiryState } from "@/lib/format";

export const metadata: Metadata = { title: "Rokovi i dokumenta" };

export default async function DocumentsPage(props: PageProps<"/documents">) {
  await requireAccess("documents");
  const sp = await props.searchParams;
  const [t, { locale }, rows, { refs }, m] = await Promise.all([getT(), getPrefs(), documentsWithOwner(), getRefs(), getMoney()]);
  const states = rows.map((r) => expiryState(r.expiresAt, m.warnDays));
  const count = (s: string) => states.filter((x) => x === s).length;
  const byType = (et: string) => rows.filter((r) => r.entityType === et).length;
  const sr = locale === "sr";

  return (
    <>
      <PageHeader title={t("p.documents.title")} sub={t("p.documents.sub")} tabs={<SectionTabs group="fleet" />} />

      <div className="mb-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 content-start gap-x-8 gap-y-6">
          <Stat label={t("e.expired")} value={count("expired")} delta={count("expired") ? (sr ? "Hitno" : "Urgent") : undefined} deltaTone="bad" info={sr ? "Dokumenta kojima je rok već prošao." : "Documents already past their expiry."} />
          <Stat label={t("d.soon", { n: m.warnDays })} value={count("soon")} info={sr ? "Broj dana menjaš u Podešavanjima." : "Change the number of days in Settings."} />
          <Stat label={sr ? "Vozila i prikolice" : "Vehicles & trailers"} value={byType("vehicle") + byType("trailer")} sub={sr ? "dokumenata" : "documents"} />
          <Stat label={sr ? "Vozači" : "Drivers"} value={byType("employee")} sub={sr ? "dokumenata" : "documents"} />
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">{sr ? "Stanje dokumenata" : "Document status"}</div>
          <Distribution
            labels={{ category: sr ? "Status" : "Status", count: sr ? "Broj" : "Count", total: sr ? "Ukupno" : "Total" }}
            segments={[
              { key: "ok", label: t("e.ok"), count: count("ok"), color: "var(--good)" },
              { key: "soon", label: t("e.soon"), count: count("soon"), color: "var(--warn)" },
              { key: "expired", label: t("e.expired"), count: count("expired"), color: "var(--bad)" },
            ]}
          />
        </div>
      </div>

      <DocumentsTable rows={rows} refs={refs} initialFilter={sp.filter === "attention" ? "attention" : undefined} />
    </>
  );
}
