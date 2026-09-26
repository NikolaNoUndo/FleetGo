"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { usePrefs } from "../prefs";
import { Badge, Button } from "../ui/primitives";
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
    <div className="w-full sm:w-44">
      <Select value={value} onChange={(e) => onChange(e.target.value as Period)} className="h-9 text-[13.5px]">
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
    <Button variant="primary" size="md" onClick={onClick} className="h-9">
      <Plus size={16} strokeWidth={2.2} />
      {t("c.add")}
    </Button>
  );
}

export function Amount({ amount, currency }: { amount: number | null; currency: string }) {
  const { money } = usePrefs();
  return <span className="font-medium whitespace-nowrap text-ink">{money(amount, currency)}</span>;
}

export function PaidBadge({ paid }: { paid: boolean }) {
  const { t } = usePrefs();
  return paid ? <Badge tone="good">{t("c.paid")}</Badge> : <Badge tone="warn">{t("c.unpaid")}</Badge>;
}

export function AssetStatus({ status }: { status: string }) {
  const { opt } = usePrefs();
  const tone = status === "active" ? "good" : status === "in_service" ? "warn" : "neutral";
  return (
    <Badge tone={tone}>
      <span className={`size-1.5 rounded-full ${tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : "bg-ink-4"}`} />
      {opt(ASSET_STATUS, status)}
    </Badge>
  );
}

export function EmployeeStatus({ status }: { status: string }) {
  const { opt } = usePrefs();
  const tone = status === "active" ? "good" : status === "leave" ? "warn" : "neutral";
  return (
    <Badge tone={tone}>
      <span className={`size-1.5 rounded-full ${tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : "bg-ink-4"}`} />
      {opt(EMPLOYEE_STATUS, status)}
    </Badge>
  );
}

/** Two-line cell: strong primary text and a muted line under it. */
export function Stack({ main, sub }: { main: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="max-w-[300px] min-w-0 leading-tight">
      <div className="truncate font-medium text-ink">{main}</div>
      {sub && <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** Footer row with a converted total in the display currency. */
export function TotalRow({ colSpan, before, total, after = 0, extra }: { colSpan: number; before?: number; total: number; after?: number; extra?: React.ReactNode }) {
  const { t, currency, locale } = usePrefs();
  const fmt = new Intl.NumberFormat(locale === "sr" ? "sr-Latn-RS" : "en-GB", { maximumFractionDigits: currency === "RSD" ? 0 : 2, minimumFractionDigits: currency === "RSD" ? 0 : 2 }).format(total);
  return (
    <tr className="border-t border-line bg-surface-2/60">
      <td colSpan={before ?? colSpan} className="h-12 pl-5 text-[13px] font-medium text-ink-3">
        {t("c.total")} {extra}
      </td>
      <td className="px-4 text-right text-[14px] font-semibold whitespace-nowrap tnum">{currency === "EUR" ? `€${fmt}` : `${fmt} RSD`}</td>
      {after > 0 && <td colSpan={after} />}
    </tr>
  );
}

export const today = todayISO;
