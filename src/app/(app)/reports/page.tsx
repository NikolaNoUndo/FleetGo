import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { ReportFilters } from "@/components/report-filters";
import { ReportSheet } from "@/components/report-sheet";
import { requireContext } from "@/lib/auth/context";
import { getPrefs } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { allowedReports, buildReport, parseReportParams, reportTab } from "@/lib/reports";

export const metadata: Metadata = { title: "Izveštaji" };

export default async function ReportsPage(props: PageProps<"/reports">) {
  const ctx = await requireContext();
  const allowed = allowedReports(ctx);
  if (!allowed.length) redirect("/no-access");
  const params = parseReportParams(await props.searchParams, allowed)!;
  const [{ locale, currency }, { refs }] = await Promise.all([getPrefs(), getRefs()]);
  const report = await buildReport(ctx, params, locale, currency);
  const sr = locale === "sr";
  const assets = params.kind === "fuel" ? (refs.vehicles ?? []) : [...(refs.vehicles ?? []), ...(refs.trailers ?? [])];

  return (
    <>
      <PageHeader
        title={sr ? "Izveštaji" : "Reports"}
        sub={sr ? "Izaberi izveštaj i period, pa ga odštampaj ili sačuvaj kao PDF." : "Pick a report and a period, then print it or save it as PDF."}
      />
      <ReportFilters
        params={params}
        kinds={allowed.map((k) => ({ value: k, label: reportTab(k, locale) }))}
        vehicles={assets.map((v) => ({ id: v.id, label: v.label }))}
        drivers={((params.kind === "payments" ? refs.employees : refs.drivers) ?? []).map((v) => ({ id: v.id, label: v.label }))}
        suppliers={(refs.suppliers ?? []).map((v) => ({ id: v.id, label: v.label }))}
      />
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface-2 p-3 sm:p-6">
        <div className="mx-auto max-w-[1100px] rounded-lg bg-white p-5 shadow-sm sm:p-8">
          <ReportSheet report={report} locale={locale} />
        </div>
      </div>
    </>
  );
}
