import type { Currency, Locale } from "./catalog";

export type Money = { amount: number | null; currency: string | null };

export function toCurrency(amount: number, from: string, to: Currency, rate: number): number {
  if (!amount) return 0;
  if (from === to) return amount;
  if (from === "EUR" && to === "RSD") return amount * rate;
  if (from === "RSD" && to === "EUR") return amount / rate;
  return amount;
}

const intl = (locale: Locale) => (locale === "sr" ? "sr-Latn-RS" : "en-GB");

export function fmtMoney(amount: number | null | undefined, currency: string, locale: Locale, opts?: { compact?: boolean; decimals?: number }): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const decimals = opts?.decimals ?? (currency === "RSD" ? 0 : Math.abs(amount) >= 1000 ? 0 : 2);
  const n = new Intl.NumberFormat(intl(locale), {
    minimumFractionDigits: opts?.compact ? 0 : decimals,
    maximumFractionDigits: opts?.compact ? 1 : decimals,
    notation: opts?.compact ? "compact" : "standard",
  }).format(amount);
  return currency === "EUR" ? `€${n}`.replace("€-", "-€") : `${n} RSD`;
}

export function fmtNum(n: number | null | undefined, locale: Locale, decimals = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(intl(locale), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

export function fmtDate(d: string | Date | null | undefined, locale: Locale): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intl(locale), { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function fmtMonth(ym: string, locale: Locale, short = true): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(intl(locale), { month: short ? "short" : "long", year: short ? undefined : "numeric" }).format(new Date(y, m - 1, 1));
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export type ExpiryState = "expired" | "soon" | "ok" | "missing";
export function expiryState(dateISO: string | null | undefined, warnDays: number): ExpiryState {
  const n = daysUntil(dateISO);
  if (n === null) return "missing";
  if (n < 0) return "expired";
  if (n <= warnDays) return "soon";
  return "ok";
}

export function relTime(ts: number, locale: Locale): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: "auto", style: "short" });
  if (s < 60) return rtf.format(-s, "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}
