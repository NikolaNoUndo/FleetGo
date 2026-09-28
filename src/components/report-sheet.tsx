import type { Report } from "@/lib/reports";
import { cn } from "./ui/primitives";
import { RoadlineLogo } from "./brand";

/** The printable report: A4 paper look on screen, clean black-on-white when printed. */
export function ReportSheet({ report, locale }: { report: Report; locale: "sr" | "en" }) {
  const L = (sr: string, en: string) => (locale === "sr" ? sr : en);
  return (
    <article className="report-sheet mx-auto w-full bg-white text-[#111] print:max-w-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#111] pb-4">
        <div className="min-w-0">
          <div className="text-base font-semibold">{report.company.name}</div>
          <div className="mt-0.5 text-xs text-[#555]">
            {[report.company.address, report.company.pib && `PIB ${report.company.pib}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{report.title}</h1>
          <div className="mt-0.5 text-sm text-[#333]">
            {L("Period", "Period")}: <span className="font-medium tnum">{report.periodLabel}</span>
          </div>
          {report.filters.length > 0 && <div className="mt-0.5 text-xs text-[#555]">{report.filters.join(" · ")}</div>}
        </div>
      </header>

      <section
        className="report-summary mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#ddd] bg-[#ddd]"
        style={{ "--n": report.summary.length } as React.CSSProperties}
      >
        {report.summary.map((s) => (
          <div key={s.label} className="bg-white px-3 py-2.5">
            <div className="text-xs text-[#555]">{s.label}</div>
            <div className="mt-0.5 text-base font-semibold tnum">{s.value}</div>
            {s.sub && <div className="mt-0.5 text-xs text-[#666] tnum">{s.sub}</div>}
          </div>
        ))}
      </section>

      {report.empty ? (
        <p className="mt-8 text-center text-sm text-[#666]">{L("Nema podataka za izabrani period i filtere.", "No data for the selected period and filters.")}</p>
      ) : (
        report.tables.map((tb, i) => (
          <section key={i} className="mt-6">
            {tb.title && <h2 className="mb-2 text-sm font-semibold">{tb.title}</h2>}
            <div className="no-scrollbar overflow-x-auto print:overflow-visible">
              <table className="report-table w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {tb.columns.map((c) => (
                      <th key={c.key} className={cn("border-b border-[#111] px-2 py-1.5 text-left font-semibold whitespace-nowrap", c.align === "right" && "text-right")}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r, j) => (
                    <tr key={j} className="border-b border-[#e5e5e5] even:bg-[#fafafa] print:even:bg-transparent">
                      {tb.columns.map((c) => (
                        <td key={c.key} className={cn("px-2 py-1.5 align-top", c.align === "right" && "text-right tnum", c.nowrap && "whitespace-nowrap")}>
                          {r[c.key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {tb.foot && (
                  <tfoot>
                    <tr className="border-t-2 border-[#111] font-semibold">
                      {tb.columns.map((c) => (
                        <td key={c.key} className={cn("px-2 py-1.5", c.align === "right" && "text-right tnum", "whitespace-nowrap")}>
                          {tb.foot?.[c.key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        ))
      )}

      <footer className="mt-8 border-t border-[#ddd] pt-3 text-[11px] leading-relaxed text-[#666]">
        <p>{report.note}</p>
        <p className="mt-1 flex flex-wrap justify-between gap-2">
          <span>{report.generated}</span>
          <RoadlineLogo tone="onLight" height={10} className="opacity-60" />
        </p>
      </footer>
    </article>
  );
}
