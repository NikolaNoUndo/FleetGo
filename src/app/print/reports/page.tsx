import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportSheet } from "@/components/report-sheet";
import { PrintToolbar } from "@/components/print-toolbar";
import { getContext } from "@/lib/auth/context";
import { getPrefs } from "@/lib/prefs";
import { allowedReports, buildReport, parseReportParams } from "@/lib/reports";

export const metadata: Metadata = { title: "Izveštaj" };

/** Stand-alone page without the app shell, sized for A4 and opened in a new tab for printing. */
export default async function PrintReportPage(props: PageProps<"/print/reports">) {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  const allowed = allowedReports(ctx);
  if (!allowed.length) redirect("/no-access");
  const params = parseReportParams(await props.searchParams, allowed)!;
  const { locale, currency } = await getPrefs();
  const report = await buildReport(ctx, params, locale, currency);
  return (
    <main className="min-h-dvh bg-[#eceef3] py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4 ${report.landscape ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      <PrintToolbar locale={locale} />
      <div className={report.landscape ? "mx-auto max-w-[1120px] bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none" : "mx-auto max-w-[820px] bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none"}>
        <ReportSheet report={report} locale={locale} />
      </div>
    </main>
  );
}
