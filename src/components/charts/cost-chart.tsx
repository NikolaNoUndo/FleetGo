"use client";

import { useMemo, useState } from "react";
import { usePrefs } from "../prefs";
import { Select, Segmented } from "../ui/client";
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

const W = 1000;
const H = 300;
const PAD = { top: 16, right: 20, bottom: 34, left: 72 };

/** Total monthly cost as an area with a crosshair tooltip that breaks it down by category. */
export function CostChart({ data }: { data: MonthCosts[] }) {
  const { t, locale, currency } = usePrefs();
  const [range, setRange] = useState<"6" | "12">("6");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => data.slice(-Number(range)), [data, range]);

  const totals = rows.map((d) => d.fuel + d.services + d.parts + d.payments);
  const max = niceMax(Math.max(...totals, 1) * 1.08);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const money = (v: number, compact = false) => fmtMoney(v, currency, locale, { compact });

  const line = totals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(totals.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`;
  const cur = hover !== null && hover < rows.length ? hover : null;
  const d = cur !== null ? rows[cur] : null;
  const pctX = (i: number) => (x(i) / W) * 100;
  const pctY = (v: number) => (y(v) / H) * 100;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    rows.forEach((_, i) => {
      const dd = Math.abs(x(i) - px);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    setHover(best);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {t(s.label)}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Segmented size="sm" value={view} onChange={setView} items={[{ value: "chart", label: t("c.chart") }, { value: "table", label: t("c.table") }]} />
          <div className="w-48">
            <Select value={range} onChange={(e) => setRange(e.target.value as "6" | "12")} aria-label="Period">
              <option value="6">{locale === "sr" ? "Poslednjih 6 meseci" : "Last 6 months"}</option>
              <option value="12">{locale === "sr" ? "Poslednjih 12 meseci" : "Last 12 months"}</option>
            </Select>
          </div>
        </div>
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto px-4 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="h-8 text-left font-medium" />
                {SERIES.map((s) => (
                  <th key={s.key} className="px-2 text-right font-medium whitespace-nowrap">
                    {t(s.label)}
                  </th>
                ))}
                <th className="pl-2 text-right font-medium">{t("c.total")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m.key} className="border-b border-line/60 last:border-0">
                  <td className="h-9 font-medium capitalize">{fmtMonth(m.key, locale, false)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-2 text-right whitespace-nowrap text-ink-2 tnum">
                      {money(m[s.key])}
                    </td>
                  ))}
                  <td className="pl-2 text-right font-semibold whitespace-nowrap tnum">{money(totals[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-b-xl bg-gradient-to-b from-[#f6f7fe] to-surface px-2 pt-3 pb-1">
          <div className="relative touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-[280px] w-full" preserveAspectRatio="none" role="img" aria-label={t("d.costsByMonth")}>
              <defs>
                <linearGradient id="cost-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#6366f1" stopOpacity="0.34" />
                  <stop offset="1" stopColor="#6366f1" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              {ticks.map((v) => (
                <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#d9dcf0" strokeDasharray={v === 0 ? undefined : "6 6"} vectorEffect="non-scaling-stroke" />
              ))}
              {rows.map((m, i) => (
                <line key={m.key} x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + plotH} stroke="#e3e5f4" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={area} fill="url(#cost-area)" />
              <path d={line} fill="none" stroke="#4f46e5" strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {cur !== null && <line x1={x(cur)} x2={x(cur)} y1={PAD.top} y2={PAD.top + plotH} stroke="#3a35c2" strokeDasharray="7 6" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />}
            </svg>
            {totals.map((v, i) => (
              <span
                key={rows[i].key}
                className="pointer-events-none absolute size-2.5 rounded-full border-2 border-[#cfd0fb] transition-transform"
                style={{ left: `${pctX(i)}%`, top: `${pctY(v)}%`, transform: `translate(-50%,-50%) scale(${cur === i ? 1.4 : 1})`, background: cur === i ? "#3a35c2" : "#7471f0" }}
              />
            ))}
            {ticks.map((v) => (
              <span key={v} className="pointer-events-none absolute left-2 -translate-y-1/2 text-xs text-ink-3 tnum" style={{ top: `${pctY(v)}%` }}>
                {money(v, true)}
              </span>
            ))}
            {rows.map((m, i) => (
              <span
                key={m.key}
                className={`pointer-events-none absolute bottom-1.5 -translate-x-1/2 text-xs capitalize ${cur === i ? "font-semibold text-ink" : "text-ink-3"}`}
                style={{ left: `${pctX(i)}%` }}
              >
                {fmtMonth(m.key, locale)}
              </span>
            ))}
            {d && cur !== null && (
              <div
                className="animate-pop pointer-events-none absolute z-10 w-[232px] rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur"
                style={{
                  left: `${pctX(cur)}%`,
                  top: `${Math.min(pctY(totals[cur]), 45)}%`,
                  transform: cur >= rows.length / 2 ? "translate(calc(-100% - 16px), -10%)" : "translate(16px, -10%)",
                }}
              >
                <div className="border-b border-line pb-2 text-sm font-semibold capitalize">{fmtMonth(d.key, locale, false)}</div>
                <ul className="space-y-1.5 border-b border-line py-2">
                  {SERIES.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-ink-2">
                        <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                        {t(s.label)}
                      </span>
                      <span className="text-ink-2 tnum">{money(d[s.key])}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-[3px] bg-accent" />
                    {t("c.total")}
                  </span>
                  <span className="font-semibold tnum">{money(totals[cur])}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
