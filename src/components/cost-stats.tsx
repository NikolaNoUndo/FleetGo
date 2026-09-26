import { Stat, StatRow } from "./stat";
import { getMoney, inMonth, pctDelta } from "@/lib/money-server";
import { getT } from "@/lib/prefs";
import { fmtNum } from "@/lib/format";

type Row = { date: string; amount: number | null; currency: string; paid?: boolean; liters?: number; employeeId?: string | null };

/** Inline KPI row for cost pages: this month vs. the same days last month, plus two page-specific figures. */
export async function CostStats({ rows, fuel, payments, names }: { rows: Row[]; fuel?: boolean; payments?: boolean; names?: Record<string, string> }) {
  const [m, t] = await Promise.all([getMoney(), getT()]);
  const sr = m.locale === "sr";
  const cur = rows.filter((r) => inMonth(r.date, 0));
  const prev = rows.filter((r) => inMonth(r.date, -1));
  const curSum = m.sum(cur);
  const prevSum = m.sum(prev);
  const day = new Date().getDate();
  const prevSame = m.sum(prev.filter((r) => Number(r.date.slice(8, 10)) <= day));
  const d = pctDelta(curSum, prevSame);

  let third: React.ReactNode;
  let fourth: React.ReactNode;
  if (fuel) {
    const liters = cur.reduce((s, r) => s + (r.liters ?? 0), 0);
    const priced = cur.filter((r) => r.amount != null && r.liters);
    const pricedL = priced.reduce((s, r) => s + (r.liters ?? 0), 0);
    const perL = pricedL ? m.sum(priced) / pricedL : 0;
    third = <Stat label={sr ? "Litara ovog meseca" : "Litres this month"} value={`${fmtNum(liters, m.locale)} l`} sub={`${cur.length} ${sr ? "sipanja" : "refuels"}`} />;
    fourth = <Stat label={sr ? "Prosečna cena po litru" : "Average price per litre"} value={pricedL ? m.fmt(perL) : "—"} info={sr ? "Samo unosi sa cenom, preračunati u izabranu valutu." : "Only refuels with a price, converted to the selected currency."} />;
  } else if (payments) {
    const byEmp = new Map<string, number>();
    for (const r of cur) if (r.employeeId) byEmp.set(r.employeeId, (byEmp.get(r.employeeId) ?? 0) + m.conv(r.amount, r.currency));
    const top = [...byEmp.entries()].sort((a, b) => b[1] - a[1])[0];
    third = <Stat label={sr ? "Isplaćeno vozača" : "Drivers paid"} value={byEmp.size} sub={t("c.thisMonth")} />;
    fourth = <Stat label={sr ? "Najviše isplaćeno" : "Highest paid"} value={top ? m.fmt(top[1]) : "—"} sub={top ? names?.[top[0]] : undefined} />;
  } else {
    const unpaid = rows.filter((r) => r.paid === false);
    third = (
      <Stat
        label={t("c.unpaid")}
        value={m.fmt(m.sum(unpaid))}
        delta={unpaid.length ? `${unpaid.length} ${sr ? "računa" : "invoices"}` : undefined}
        deltaTone="warn"
        info={sr ? "Svi neplaćeni računi, bez obzira na period." : "All unpaid invoices, any period."}
      />
    );
    const yearSum = m.sum(rows.filter((r) => r.date.slice(0, 4) === String(new Date().getFullYear())));
    fourth = <Stat label={sr ? "Ova godina" : "This year"} value={m.fmt(yearSum)} />;
  }

  return (
    <StatRow>
      <Stat
        label={t("c.thisMonth")}
        value={m.fmt(curSum)}
        delta={d?.text}
        info={sr ? `Poređenje sa istim periodom prošlog meseca (1–${day}.).` : `Compared with the same days last month (1–${day}).`}
        sub={d ? `${t("d.vsLast")} (1–${day}.)` : undefined}
      />
      <Stat label={sr ? "Prošli mesec" : "Last month"} value={m.fmt(prevSum)} sub={`${prev.length} ${sr ? "unosa" : "entries"}`} />
      {third}
      {fourth}
    </StatRow>
  );
}
