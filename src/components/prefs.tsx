"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Currency, Locale, Option } from "@/lib/catalog";
import { translate, type TKey } from "@/lib/i18n";
import { fmtDate, fmtMoney, fmtNum, toCurrency } from "@/lib/format";

type Prefs = {
  locale: Locale;
  currency: Currency;
  rate: number;
  warnDays: number;
};

type Ctx = Prefs & {
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  money: (amount: number | null | undefined, currency: string) => string;
  /** Converted into the currently selected display currency. */
  moneyIn: (amount: number | null | undefined, from: string, opts?: { compact?: boolean }) => string;
  conv: (amount: number | null | undefined, from: string) => number;
  num: (n: number | null | undefined, decimals?: number) => string;
  date: (d: string | null | undefined) => string;
  opt: (set: Option[], value: string | null | undefined) => string;
};

const PrefsCtx = createContext<Ctx | null>(null);

export function PrefsProvider({ value, children }: { value: Prefs; children: React.ReactNode }) {
  const { locale, currency, rate } = value;
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  const ctx = useMemo<Ctx>(
    () => ({
      ...value,
      t,
      money: (a, c) => fmtMoney(a, c, locale),
      conv: (a, from) => toCurrency(a ?? 0, from, currency, rate),
      moneyIn: (a, from, opts) => fmtMoney(toCurrency(a ?? 0, from, currency, rate), currency, locale, opts),
      num: (n, d = 0) => fmtNum(n, locale, d),
      date: (d) => fmtDate(d, locale),
      opt: (set, v) => (v ? (set.find((x) => x.value === v)?.label[locale] ?? v) : ""),
    }),
    [value, t, locale, currency, rate],
  );
  return <PrefsCtx.Provider value={ctx}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error("usePrefs outside PrefsProvider");
  return c;
}
