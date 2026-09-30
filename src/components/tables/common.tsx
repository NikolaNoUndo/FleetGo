"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { usePrefs } from "../prefs";
import { Button, Dot, StatusDot } from "../ui/primitives";
import { Select } from "../ui/client";
import { ASSET_STATUS, EMPLOYEE_STATUS } from "@/lib/catalog";
import { todayISO } from "@/lib/format";

export type Period = "month" | "prev" | "3m" | "year" | "all";

export function periodStart(p: Period): { from: string | null; to: string | null } {
  const now = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  switch (p) {
    case "month":
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: null };
    case "prev":
      return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "3m":
      return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: null };
    case "year":
      return { from: `${now.getFullYear()}-01-01`, to: null };
    default:
      return { from: null, to: null };
  }
}

export function usePeriod<T extends { date: string }>(rows: T[], initial: Period = "all") {
  const [period, setPeriod] = useState<Period>(initial);
  const filtered = useMemo(() => {
    const { from, to } = periodStart(period);
    return rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  }, [rows, period]);
  return { period, setPeriod, filtered };
}

export function PeriodSelect({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { locale } = usePrefs();
  const L =
    locale === "sr"
      ? { month: "Ovaj mesec", prev: "Prošli mesec", "3m": "Poslednja 3 meseca", year: "Ova godina", all: "Ceo period" }
      : { month: "This month", prev: "Last month", "3m": "Last 3 months", year: "This year", all: "All time" };
  return (
    // phones: shares the row under the search with the Add button
    <div className="min-w-[40%] flex-1 sm:w-44 sm:min-w-0 sm:flex-none">
      <Select value={value} onChange={(e) => onChange(e.target.value as Period)}>
        {(Object.keys(L) as Period[]).map((k) => (
          <option key={k} value={k}>
            {L[k]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function AddButton({ onClick }: { onClick: () => void }) {
  const { t } = usePrefs();
  return (
    // phones: a square "+" that sits next to the search / filters
    <Button variant="dark" size="md" onClick={onClick} aria-label={t("c.add")} className="max-sm:w-[40px] max-sm:px-0">
      <Plus className="max-sm:size-[18px]" />
      <span className="max-sm:sr-only">{t("c.add")}</span>
    </Button>
  );
}

export function Amount({ amount, currency }: { amount: number | null; currency: string }) {
  const { money } = usePrefs();
  return <span className="font-medium whitespace-nowrap text-ink">{money(amount, currency)}</span>;
}

export function PaidBadge({ paid }: { paid: boolean }) {
  const { t } = usePrefs();
  return paid ? <StatusDot tone="good">{t("c.paid")}</StatusDot> : <StatusDot tone="warn">{t("c.unpaid")}</StatusDot>;
}

export function AssetStatus({ status }: { status: string }) {
  const { opt } = usePrefs();
  return <StatusDot tone={status === "active" ? "good" : status === "in_service" ? "warn" : "neutral"}>{opt(ASSET_STATUS, status)}</StatusDot>;
}

export function EmployeeStatus({ status }: { status: string }) {
  const { opt } = usePrefs();
  return <StatusDot tone={status === "active" ? "good" : status === "leave" ? "warn" : "neutral"}>{opt(EMPLOYEE_STATUS, status)}</StatusDot>;
}

/** Two-line cell: strong primary text and a muted line under it. */
export function Stack({ main, sub, dot }: { main: React.ReactNode; sub?: React.ReactNode; dot?: "good" | "warn" | "bad" | "neutral" | "accent" }) {
  return (
    <div className="flex max-w-[300px] min-w-0 items-center gap-2.5">
      {dot && <Dot tone={dot} />}
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{main}</div>
        {sub && <div className="truncate text-xs text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}

/** Footer row with a converted total in the display currency. */
export function TotalRow({ colSpan, before, total, after = 0, extra }: { colSpan: number; before?: number; total: number; after?: number; extra?: React.ReactNode }) {
  const { t, currency, locale } = usePrefs();
  const fmt = new Intl.NumberFormat(locale === "sr" ? "sr-Latn-RS" : "en-GB", { maximumFractionDigits: currency === "RSD" ? 0 : 2, minimumFractionDigits: currency === "RSD" ? 0 : 2 }).format(total);
  return (
    <tr className="border-t border-line bg-surface-2">
      <td colSpan={before ?? colSpan} className="h-10 pl-4 text-xs font-medium text-ink-3">
        {t("c.total")} {extra}
      </td>
      <td className="px-3 text-right font-semibold whitespace-nowrap tnum">{currency === "EUR" ? `€${fmt}` : `${fmt} RSD`}</td>
      {after > 0 && <td colSpan={after} />}
    </tr>
  );
}

export const today = todayISO;
