import "server-only";
import { cookies } from "next/headers";
import type { Currency, Locale } from "./catalog";
import { translate, type TKey } from "./i18n";

export async function getPrefs(): Promise<{ locale: Locale; currency: Currency }> {
  const c = await cookies();
  const locale = c.get("rl_locale")?.value === "en" ? "en" : "sr";
  const currency = c.get("rl_currency")?.value === "RSD" ? "RSD" : "EUR";
  return { locale, currency };
}

export async function getT() {
  const { locale } = await getPrefs();
  return (key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}
