/**
 * "Other costs" (expenses) count in the months they belong to, not only the day
 * they were paid: a cost can start counting in a later month ("bought now, used
 * from November") and be spread evenly over several months (yearly insurance,
 * a stock of something used over two months). Safe on client and server.
 */

export type ExpenseLike = {
  date: string;
  costFrom: string | null;
  spreadMonths: number;
  amount: number | null;
  currency: string;
};

export const monthKey = (iso: string) => iso.slice(0, 7);

/** "2026-09" + n months → "2026-11" */
export function addMonthsKey(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Same day of month `n` months later, clamped to the month's length (31 Jan → 28 Feb). */
export function addMonthsDate(iso: string, n: number, anchorDay = Number(iso.slice(8, 10))): string {
  const key = addMonthsKey(monthKey(iso), n);
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key}-${String(Math.min(anchorDay, last)).padStart(2, "0")}`;
}

export const MAX_SPREAD = 60;

/** The parts of one cost that fall into each month. Costs without a price have none. */
export function expenseSlices(e: ExpenseLike): { month: string; amount: number; currency: string }[] {
  if (e.amount === null || e.amount === undefined) return [];
  const n = Math.min(Math.max(1, Math.round(e.spreadMonths || 1)), MAX_SPREAD);
  const start = monthKey(e.costFrom ?? e.date);
  const part = e.amount / n;
  return Array.from({ length: n }, (_, i) => ({ month: addMonthsKey(start, i), amount: part, currency: e.currency }));
}

/** Rows shaped like other cost rows ({date, amount, currency}), one per month slice, dated the 1st. */
export function expenseMonthRows<T extends ExpenseLike>(rows: T[]): (T & { date: string; amount: number })[] {
  return rows.flatMap((r) => expenseSlices(r).map((s) => ({ ...r, date: `${s.month}-01`, amount: s.amount })));
}

/** Short description of how a cost is counted, e.g. "÷ 3 mes. od nov 2026". */
export function allocationLabel(e: ExpenseLike & { recurring?: boolean }, locale: "sr" | "en"): string | null {
  const sr = locale === "sr";
  const parts: string[] = [];
  if (e.recurring) parts.push(sr ? "mesečno" : "monthly");
  const n = Math.max(1, e.spreadMonths || 1);
  if (n > 1) parts.push(sr ? `na ${n} mes.` : `over ${n} mo.`);
  if (e.costFrom && monthKey(e.costFrom) !== monthKey(e.date)) {
    const [y, m] = monthKey(e.costFrom).split("-").map(Number);
    const name = new Intl.DateTimeFormat(sr ? "sr-Latn-RS" : "en-GB", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
    parts.push(sr ? `od ${name.replace(/\.$/, "")}` : `from ${name}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
