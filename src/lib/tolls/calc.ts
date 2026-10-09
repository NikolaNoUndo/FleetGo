import { axleBucket, FX_PER_EUR, tollKey, type Currency } from "./countries";
import { cellsAround, distM } from "./grid";
import type { TollPart } from "./types";

export type TrackPoint = { t: number; lat: number; lon: number };

const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date(ms));

/**
 * Km driven on tolled roads per network key ("RS", "PL-A2"…). A step between two GPS points
 * counts when both points lie on the same network; a priced stretch inside a country beats
 * the country itself. Steps faster than 160 km/h are GPS jumps and are skipped; a gap
 * (tunnel, no signal) counts as the straight line. Also returns the days spent on each network.
 */
export function tolledKm(points: TrackPoint[], keysOf: (cell: number) => string[] | undefined) {
  const at = points.map((p) => {
    const set = new Set<string>();
    for (const c of cellsAround(p.lat, p.lon)) for (const k of keysOf(c) ?? []) set.add(k);
    return set;
  });
  const km: Record<string, number> = {};
  const days: Record<string, Set<string>> = {};
  let trackKm = 0;
  let last: string | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const d = distM(a.lat, a.lon, b.lat, b.lon);
    if (d <= 0) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt > 0 && (d / dt) * 3.6 > 160) continue;
    trackKm += d / 1000;
    const common = [...at[i - 1]].filter((k) => at[i].has(k));
    if (!common.length) {
      last = null;
      continue;
    }
    const zones = common.filter((k) => k.length > 2);
    const pool = zones.length ? zones : common;
    const k: string = last && pool.includes(last) ? last : pool[0];
    km[k] = (km[k] ?? 0) + d / 1000;
    (days[k] ??= new Set()).add(dayOf(b.t));
    last = k;
  }
  return { km, trackKm, days: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v.size])) as Record<string, number> };
}

const toEur = (amount: number, cur: Currency, rsdPerEur: number) => (cur === "EUR" ? amount : cur === "RSD" ? amount / rsdPerEur : amount / FX_PER_EUR[cur]);

/** Cheapest set of vignettes covering this many days (1-day, 7-day, 30-day…). */
export function vignetteCost(days: number, options: { days: number; eur: number }[]) {
  const best = new Array(days + 1).fill(Infinity);
  best[0] = 0;
  for (let d = 1; d <= days; d++) for (const o of options) best[d] = Math.min(best[d], best[Math.max(0, d - o.days)] + o.eur);
  return best[days];
}

/**
 * Turns the km per network into money for a combination with this many axles (truck +
 * trailer). `startDate` picks the right system where it changed (Romania: vignette before TollRo).
 */
export function tollParts(km: Record<string, number>, days: Record<string, number>, axles: number, rsdPerEur: number, startDate: string): TollPart[] {
  const bucket = axleBucket(axles);
  // Romania before TollRo: one vignette for all its roads, counted by days
  const vignetteDays: Record<string, number> = {};
  const parts: TollPart[] = [];
  for (const [key, k] of Object.entries(km)) {
    if (k < 0.5) continue;
    const info = tollKey(key);
    if (!info) continue;
    const c = info.country;
    if (c.vignette && startDate < c.vignette.until) {
      vignetteDays[c.code] = Math.max(vignetteDays[c.code] ?? 0, days[key] ?? 1);
      const prev = parts.find((p) => p.country === c.code);
      if (prev) prev.km = Math.round((prev.km + k) * 10) / 10;
      else parts.push({ country: c.code, km: Math.round(k * 10) / 10, eur: 0, rate: 0, rateCurrency: "EUR" });
      continue;
    }
    const r = info.rates[bucket];
    parts.push({
      country: key,
      km: Math.round(k * 10) / 10,
      eur: Math.round(toEur(k * r.perKm, c.currency, rsdPerEur) * 100) / 100,
      rate: r.perKm,
      rateCurrency: c.currency,
      ...(r.estimated ? { estimated: true } : {}),
    });
  }
  for (const [code, d] of Object.entries(vignetteDays)) {
    const c = tollKey(code)!.country;
    const p = parts.find((x) => x.country === code)!;
    p.eur = Math.round(vignetteCost(d, c.vignette!.byBucket[bucket]) * 100) / 100;
    p.days = d;
  }
  return parts.sort((a, b) => b.km - a.km);
}

/** Axles of the whole combination; an unknown truck counts 2 axles, an unknown trailer 3. */
export function totalAxles(vehicle: { axles: number | null } | null, trailer: { axles: number | null } | null) {
  const own = vehicle?.axles ?? 2;
  const tr = trailer ? (trailer.axles ?? 3) : 0;
  return own + tr;
}
