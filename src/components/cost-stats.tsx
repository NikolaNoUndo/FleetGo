import { CalendarDays, CalendarRange, CircleDollarSign, Droplets, Hourglass, UserRound } from "lucide-react";
import { Stat, StatRow } from "./stat";
import { getMoney, inMonth, pctDelta } from "@/lib/money-server";
import { getT } from "@/lib/prefs";
import { fmtNum } from "@/lib/format";

type Row = { date: string; amount: number; currency: string; paid?: boolean; liters?: number; employeeId?: string | null };

export async function CostStats({ rows, fuel, payments, names }: { rows: Row[]; fuel?: boolean; payments?: boolean; names?: Record<string, string> }) {
  const [m, t] = await Promise.all([getMoney(), getT()]);
  const cur = rows.filter((r) => inMonth(r.date, 0));
  const prev = rows.filter((r) => inMonth(r.date, -1));
  const curSum = m.sum(cur);
  const prevSum = m.sum(prev);
  // Compare with the same part of last month (1st → today's day), not the whole month.
  const day = new Date().getDate();
  const prevSame = prev.filter((r) => Number(r.date.slice(8, 10)) <= day);
  const d = pctDelta(curSum, m.sum(prevSame));
  const sr = m.locale === "sr";

  let third: React.ReactNode;
  let fourth: React.ReactNode;
  if (fuel) {
    const liters = cur.reduce((s, r) => s + (r.liters ?? 0), 0);
    const perL = liters ? curSum / liters : 0;
    third = <Stat icon={<Droplets />} label={sr ? "Litara ovog meseca" : "Litres this month"} value={`${fmtNum(liters, m.locale)} l`} />;
    fourth = <Stat icon={<CircleDollarSign />} label={sr ? "Prosečna cena po litru" : "Average price per litre"} value={m.fmt(perL)} />;
  } else if (payments) {
    const byEmp = new Map<string, number>();
    for (const r of cur) if (r.employeeId) byEmp.set(r.employeeId, (byEmp.get(r.employeeId) ?? 0) + m.conv(r.amount, r.currency));
    const top = [...byEmp.entries()].sort((a, b) => b[1] - a[1])[0];
    third = <Stat icon={<UserRound />} label={sr ? "Isplaćeno vozača" : "Drivers paid"} value={byEmp.size} sub={t("c.thisMonth")} />;
    fourth = <Stat icon={<CircleDollarSign />} label={sr ? "Najviše isplaćeno" : "Highest paid"} value={top ? m.fmt(top[1]) : "—"} sub={top ? names?.[top[0]] : undefined} />;
  } else {
    const unpaid = rows.filter((r) => r.paid === false);
    third = <Stat icon={<Hourglass />} label={t("c.unpaid")} value={m.fmt(m.sum(unpaid))} sub={`${unpaid.length} ${sr ? "računa" : "invoices"}`} />;
    const yearSum = m.sum(rows.filter((r) => r.date.slice(0, 4) === String(new Date().getFullYear())));
    fourth = <Stat icon={<CalendarRange />} label={sr ? "Ova godina" : "This year"} value={m.fmt(yearSum)} />;
  }

  return (
    <StatRow>
      <Stat
        icon={<CalendarDays />}
        label={t("c.thisMonth")}
        value={m.fmt(curSum)}
        delta={d?.text}
        deltaTone="neutral"
        sub={d ? `${t("d.vsLast")} (1–${day}.)` : undefined}
      />
      <Stat icon={<CalendarDays />} label={sr ? "Prošli mesec" : "Last month"} value={m.fmt(prevSum)} sub={`${prev.length} ${sr ? "unosa" : "entries"}`} />
      {third}
      {fourth}
    </StatRow>
  );
}
