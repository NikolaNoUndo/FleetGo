"use client";

import { useMemo, useRef, useState } from "react";
import { usePrefs } from "../prefs";
import { Segmented } from "../ui/client";
import { fmtMoney, fmtMonth } from "@/lib/format";
import type { TKey } from "@/lib/i18n";

export type MonthCosts = { key: string; fuel: number; services: number; parts: number; payments: number };

const SERIES: { key: keyof Omit<MonthCosts, "key">; label: TKey; color: string }[] = [
  { key: "fuel", label: "cat.fuel", color: "var(--s1)" },
  { key: "services", label: "cat.services", color: "var(--s2)" },
  { key: "parts", label: "cat.parts", color: "var(--s3)" },
  { key: "payments", label: "cat.payments", color: "var(--s4)" },
];

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

/** Stacked monthly costs with a crosshair tooltip (hover or tap a month). */
export function CostChart({ data }: { data: MonthCosts[] }) {
  const { t, locale, currency } = usePrefs();
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const wrap = useRef<HTMLDivElement>(null);

  const totals = data.map((d) => d.fuel + d.services + d.parts + d.payments);
  const max = niceMax(Math.max(...totals, 1) * 1.05);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const H = 240;
  const padTop = 12;
  const padBottom = 28;
  const plotH = H - padTop - padBottom;
  const y = (v: number) => padTop + plotH - (v / max) * plotH;
  const money = (v: number, compact = false) => fmtMoney(v, currency, locale, { compact });

  const cur = hover ?? data.length - 1;
  const d = data[cur];
  const bars = useMemo(() => data.map((m) => {
    let acc = 0;
    return SERIES.map((s) => {
      const v = m[s.key];
      const seg = { key: s.key, color: s.color, y0: acc, y1: acc + v };
      acc += v;
      return seg;
    });
  }), [data]);

  return (
    <div className="px-4 pt-3 pb-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {t(s.label)}
            </li>
          ))}
        </ul>
        <Segmented size="sm" value={view} onChange={setView} items={[{ value: "chart", label: t("c.chart") }, { value: "table", label: t("c.table") }]} />
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink-3">
                <th className="h-9 text-left font-medium" />
                {SERIES.map((s) => (
                  <th key={s.key} className="px-2 text-right font-medium whitespace-nowrap">{t(s.label)}</th>
                ))}
                <th className="pl-2 text-right font-medium">{t("c.total")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m, i) => (
                <tr key={m.key} className="border-b border-line/60 last:border-0">
                  <td className="h-9 font-medium capitalize">{fmtMonth(m.key, locale, false)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-2 text-right text-ink-2 tnum whitespace-nowrap">{money(m[s.key])}</td>
                  ))}
                  <td className="pl-2 text-right font-semibold tnum whitespace-nowrap">{money(totals[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 600 ${H}`} className="block h-[240px] w-full" preserveAspectRatio="none" role="img" aria-label={t("d.costsByMonth")}>
            {ticks.map((v) => (
              <line key={v} x1={0} x2={600} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 ? undefined : "4 5"} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {/* y labels */}
          <div className="pointer-events-none absolute inset-0">
            {ticks.slice(1).map((v) => (
              <span key={v} className="absolute left-0 -translate-y-full pb-0.5 text-[11px] text-ink-3 tnum" style={{ top: y(v) }}>
                {money(v, true)}
              </span>
            ))}
          </div>
          {/* bars as HTML so they keep crisp radii at any width */}
          <div className="absolute right-0 left-12 flex" style={{ top: padTop, height: plotH }}>
            {data.map((m, i) => {
              const active = hover === i;
              return (
                <button
                  key={m.key}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onClick={() => setHover(i)}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  aria-label={`${fmtMonth(m.key, locale, false)}: ${money(totals[i])}`}
                >
                  <span className={`absolute inset-x-1 inset-y-0 rounded-lg transition-colors ${active ? "bg-surface-2" : ""}`} />
                  <span className="relative flex w-[42%] max-w-[46px] min-w-[18px] flex-col-reverse gap-[2px]" style={{ height: `${(totals[i] / max) * 100}%` }}>
                    {bars[i].map((s, si) => {
                      const h = totals[i] ? ((s.y1 - s.y0) / totals[i]) * 100 : 0;
                      if (h <= 0) return null;
                      const isTop = bars[i].slice(si + 1).every((x) => x.y1 - x.y0 <= 0);
                      return (
                        <span
                          key={s.key}
                          className={`block w-full ${isTop ? "rounded-t-[4px]" : ""} ${si === 0 ? "rounded-b-[2px]" : ""}`}
                          style={{ height: `${h}%`, background: s.color, opacity: hover === null || active ? 1 : 0.55 }}
                        />
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
          {/* x labels */}
          <div className="absolute right-0 bottom-0 left-12 flex h-6 items-end">
            {data.map((m, i) => (
              <span key={m.key} className={`flex-1 text-center text-[12px] capitalize ${cur === i && hover !== null ? "font-semibold text-ink" : "text-ink-3"}`}>
                {fmtMonth(m.key, locale)}
              </span>
            ))}
          </div>
          {/* tooltip */}
          {d && hover !== null && (
            <div
              className="animate-pop pointer-events-none absolute top-2 z-10 w-[230px] rounded-[14px] border border-line bg-surface p-3.5 shadow-pop"
              style={{
                left: `calc(48px + (100% - 48px) * ${(cur + 0.5) / data.length})`,
                transform: cur >= data.length / 2 ? "translateX(calc(-100% - 28px))" : "translateX(28px)",
              }}
            >
              <div className="border-b border-line pb-2 text-[14px] font-semibold capitalize">{fmtMonth(d.key, locale, false)}</div>
              <ul className="space-y-1.5 border-b border-line py-2.5">
                {SERIES.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="inline-flex items-center gap-2 text-ink-2">
                      <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                      {t(s.label)}
                    </span>
                    <span className="text-ink tnum">{money(d[s.key])}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-2 text-[13.5px] font-semibold">
                <span>{t("c.total")}</span>
                <span className="tnum">{money(totals[cur])}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
