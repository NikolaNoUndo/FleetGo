import "server-only";
import { getPrefs } from "./prefs";
import { getCompany } from "./tenant";
import { fmtMoney, toCurrency } from "./format";
import { companyRate } from "./fx";

/** Server-side helpers for totals in the viewer's display currency. */
export async function getMoney() {
  const [{ currency, locale }, company] = await Promise.all([getPrefs(), getCompany()]);
  const rate = await companyRate(company);
  const conv = (amount: number | null | undefined, from: string) => toCurrency(amount ?? 0, from, currency, rate);
  const sum = (rows: { amount: number | null; currency: string }[]) => rows.reduce((s, r) => s + conv(r.amount, r.currency), 0);
  const fmt = (n: number, opts?: { compact?: boolean }) => fmtMoney(n, currency, locale, opts);
  return { currency, locale, conv, sum, fmt, rate, warnDays: company.warnDays };
}

export function monthBounds(offset = 0) {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: ymd(s), to: ymd(e), key: ymd(s).slice(0, 7) };
}

export const inMonth = (date: string, offset = 0) => {
  const b = monthBounds(offset);
  return date >= b.from && date <= b.to;
};

export function pctDelta(cur: number, prev: number): { text: string; up: boolean; pct: number } | null {
  if (!prev) return null;
  const p = ((cur - prev) / prev) * 100;
  return { text: `${p >= 0 ? "+" : ""}${Math.round(p)}%`, up: p >= 0, pct: p };
}
