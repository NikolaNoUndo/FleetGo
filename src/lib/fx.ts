import "server-only";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Official NBS middle rate for EUR→RSD.
 * Source: kurs.resenje.org, which republishes the National Bank of Serbia list every morning.
 * Stored once per day in fx_rates; if the source is unreachable we keep using the last stored rate.
 */
const SOURCE_URL = "https://kurs.resenje.org/api/v1/currencies/eur/rates/today";
const FALLBACK = 117.2;

function belgradeToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Accepts the kurs.resenje.org shape and a few common alternatives. */
export function parseRate(json: unknown): { rate: number; date: string | null } | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const candidates = [o.exchange_middle, o.middle_rate, o.middle, o.srednji_kurs, o.rate];
  for (const c of candidates) {
    const n = typeof c === "string" ? Number(c.replace(",", ".")) : typeof c === "number" ? c : NaN;
    // sanity window for EUR/RSD
    if (Number.isFinite(n) && n > 90 && n < 150) return { rate: n, date: typeof o.date === "string" ? o.date : null };
  }
  return null;
}

let lastAttempt = 0;

async function fetchNbs(): Promise<{ rate: number; date: string | null } | null> {
  if (Date.now() - lastAttempt < 10 * 60 * 1000) return null; // at most every 10 min per instance
  lastAttempt = Date.now();
  try {
    const res = await fetch(SOURCE_URL, { cache: "no-store", signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return parseRate(await res.json());
  } catch (e) {
    console.warn("NBS rate fetch failed", (e as Error).message);
    return null;
  }
}

export type NbsRate = { rate: number; day: string | null; source: string; stale: boolean };

/** Today's NBS rate (fetched once per day), or the most recent stored one. */
export const getNbsRate = cache(async (): Promise<NbsRate> => {
  const today = belgradeToday();
  const [todayRow] = await db
    .select()
    .from(schema.fxRates)
    .where(and(eq(schema.fxRates.day, today), eq(schema.fxRates.currency, "EUR")))
    .limit(1);
  if (todayRow) return { rate: todayRow.rate, day: todayRow.day, source: todayRow.source, stale: false };

  const fresh = await fetchNbs();
  if (fresh) {
    await db
      .insert(schema.fxRates)
      .values({ day: today, currency: "EUR", rate: fresh.rate, source: "NBS" })
      .onConflictDoUpdate({ target: [schema.fxRates.day, schema.fxRates.currency], set: { rate: fresh.rate, fetchedAt: new Date() } });
    return { rate: fresh.rate, day: today, source: "NBS", stale: false };
  }
  const [last] = await db.select().from(schema.fxRates).where(eq(schema.fxRates.currency, "EUR")).orderBy(desc(schema.fxRates.day)).limit(1);
  if (last) return { rate: last.rate, day: last.day, source: last.source, stale: true };
  return { rate: FALLBACK, day: null, source: "fallback", stale: true };
});

/** The rate a company actually uses: NBS by default, or its own manual rate. */
export async function companyRate(company: { rateMode: string; eurRsdRate: number }): Promise<number> {
  if (company.rateMode === "manual") return company.eurRsdRate;
  return (await getNbsRate()).rate;
}
