import { axleBucket, HUF_PER_EUR, tollCountry } from "./countries";
import { cellsAround, distM } from "./grid";
import type { TollPart } from "./types";

export type TrackPoint = { t: number; lat: number; lon: number };

/**
 * Km driven on tolled roads per country. A step between two GPS points counts when both
 * points lie on the tolled network of the same country. Steps faster than 160 km/h are
 * GPS jumps and are skipped; a gap (tunnel, no signal) counts as the straight line.
 */
export function tolledKm(points: TrackPoint[], countriesOf: (cell: number) => string[] | undefined) {
  const at = points.map((p) => {
    const set = new Set<string>();
    for (const c of cellsAround(p.lat, p.lon)) for (const k of countriesOf(c) ?? []) set.add(k);
    return set;
  });
  const km: Record<string, number> = {};
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
    const k: string = last && common.includes(last) ? last : common[0];
    km[k] = (km[k] ?? 0) + d / 1000;
    last = k;
  }
  return { km, trackKm };
}

/** Converts a country's km into money for a truck with this many axles (truck + trailer). */
export function tollParts(km: Record<string, number>, axles: number, rsdPerEur: number): TollPart[] {
  const bucket = axleBucket(axles);
  return Object.entries(km)
    .filter(([, k]) => k >= 0.5)
    .map(([code, k]): TollPart | null => {
      const c = tollCountry(code);
      if (!c) return null;
      const r = c.rates[bucket];
      const local = k * r.perKm;
      const eur = c.currency === "EUR" ? local : c.currency === "RSD" ? local / rsdPerEur : local / HUF_PER_EUR;
      return { country: code, km: Math.round(k * 10) / 10, eur: Math.round(eur * 100) / 100, rate: r.perKm, rateCurrency: c.currency, ...(r.estimated ? { estimated: true } : {}) };
    })
    .filter((x): x is TollPart => !!x)
    .sort((a, b) => b.km - a.km);
}

/** Axles of the whole combination; unknown counts are filled with the usual ones. */
export function totalAxles(vehicle: { axles: number | null } | null, trailer: { axles: number | null } | null) {
  const own = vehicle?.axles ?? 2;
  const tr = trailer ? (trailer.axles ?? 3) : 0;
  return own + tr;
}
