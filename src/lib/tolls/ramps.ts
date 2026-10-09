/**
 * "Ramp to ramp" tolling (closed systems): you pay for the pair of stations where you got
 * on and off the motorway, from the operator's price list — not by the km. Serbia now;
 * Croatia, France, Spain and the Polish concessions work the same way and come next.
 */
import { distM } from "./grid";

export type RampSystem = {
  key: string;
  country: string;
  name: { sr: string; en: string };
  /** how stations show on the map: toll booths, or motorway junctions (free-flow loops) */
  stationTag: "toll_booth" | "junction";
  /** where to look for them [south, west, north, east] */
  bbox: [number, number, number, number];
  /** a GPS track passing closer than this to a station point went through it */
  passM: number;
  /** price-list category for a combination with this many axles */
  category: (axles: number) => string;
  source: string;
};

export const RAMP_SYSTEMS: RampSystem[] = [
  {
    key: "RS",
    country: "RS",
    name: { sr: "Srbija, naplatne stanice", en: "Serbia, toll stations" },
    stationTag: "toll_booth",
    bbox: [42.2, 18.8, 46.2, 23.1],
    passM: 350,
    category: (axles) => (axles >= 4 ? "IV" : "III"),
    source: "https://www.putevi-srbije.rs/index.php/sr/kategorizacija-vozila-cenovnik-putarine",
  },
  {
    key: "RS-OB",
    country: "RS",
    name: { sr: "Obilaznica oko Beograda", en: "Belgrade bypass" },
    stationTag: "junction",
    bbox: [44.6, 20.2, 44.95, 20.6],
    passM: 450,
    category: (axles) => (axles >= 4 ? "IV" : "III"),
    source: "https://www.putevi-srbije.rs/index.php/sr/kategorizacija-vozila-cenovnik-putarine",
  },
];

export const rampSystem = (key: string) => RAMP_SYSTEMS.find((s) => s.key === key);

const CYR: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s" };

/** "НС Ниш југ", "Naplatna stanica Niš jug" → "nis jug" */
export function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/[а-яђјљњћџ]/g, (ch) => CYR[ch] ?? ch)
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(naplatna stanica|naplatne stanice|naplata putarine|naplatna rampa|petlja|ns|toll|plaza|interchange|izlaz|ulaz|stanica|rampa)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ways a price-list name can be written on the map: "Čačak (Pakovraće)" → "cacak pakovrace", "pakovrace", "cacak". */
function variants(official: string) {
  const out = new Set<string>([normName(official)]);
  const inner = official.match(/\(([^)]+)\)/)?.[1];
  if (inner) {
    out.add(normName(inner));
    out.add(normName(official.replace(/\([^)]*\)/, "")));
  }
  return [...out].filter((v) => v.length >= 3);
}

const hasWords = (hay: string, needle: string) => ` ${hay} `.includes(` ${needle} `);

/**
 * Matches map points (named or not) to the price list's stations. A named point takes the
 * station whose name fits best (the longest match wins: "nis jug" over "nis"); an unnamed
 * booth joins the nearest named station within 2 km.
 */
export function matchStations(official: string[], points: { name: string; lat: number; lon: number }[]) {
  const vs = official.map(variants);
  const named: { station: number; lat: number; lon: number }[] = [];
  const unnamed: { lat: number; lon: number }[] = [];
  for (const p of points) {
    const n = normName(p.name);
    if (!n) {
      unnamed.push(p);
      continue;
    }
    let best = -1, bestLen = 0;
    vs.forEach((alts, i) => {
      for (const a of alts) if ((n === a || hasWords(n, a)) && a.length > bestLen) (best = i), (bestLen = a.length);
    });
    if (best >= 0) named.push({ station: best, lat: p.lat, lon: p.lon });
  }
  const all = [...named];
  for (const u of unnamed) {
    let best: (typeof named)[number] | null = null, bd = 2000;
    for (const s of named) {
      const d = distM(u.lat, u.lon, s.lat, s.lon);
      if (d < bd) (bd = d), (best = s);
    }
    if (best) all.push({ station: best.station, lat: u.lat, lon: u.lon });
  }
  const found = new Set(all.map((s) => s.station));
  return { points: all, missing: official.filter((_, i) => !found.has(i)) };
}

/** metres from point p to the segment a–b (flat approximation, fine at these distances) */
function toSegment(p: { lat: number; lon: number }, a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_320, m = 110_540;
  const ax = a.lon * k, ay = a.lat * m, bx = b.lon * k, by = b.lat * m, px = p.lon * k, py = p.lat * m;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export type RampTrip = { from: string; to: string; price: number; km: number };

/**
 * One trip per stretch the truck drove on this system's network, from the first to the last
 * station it went through, priced from the official list station by station. `seg[i]` is the network key of the
 * step from point i-1 to i (null off the network). Stretches with fewer than two stations
 * found are left for the per-km estimate and returned as `unpricedKm`.
 */
export function rampTrips(
  track: { lat: number; lon: number }[],
  seg: (string | null)[],
  networkKey: string,
  stations: { station: number; lat: number; lon: number }[],
  names: string[],
  price: number[][],
  passM: number,
) {
  // stretches on the network; short gaps (< 2 km off it) don't break one
  const runs: { from: number; to: number; km: number }[] = [];
  let cur: { from: number; to: number; km: number } | null = null;
  let off = 0;
  for (let i = 1; i < track.length; i++) {
    const d = distM(track[i - 1].lat, track[i - 1].lon, track[i].lat, track[i].lon);
    if (seg[i] === networkKey) {
      if (!cur) cur = { from: i - 1, to: i, km: 0 };
      cur.to = i;
      cur.km += d / 1000;
      off = 0;
    } else if (cur) {
      off += d;
      if (off > 2000) {
        runs.push(cur);
        cur = null;
        off = 0;
      }
    }
  }
  if (cur) runs.push(cur);

  const trips: RampTrip[] = [];
  let unpricedKm = 0;
  for (const r of runs) {
    if (r.km < 1) continue;
    // stations passed, in the order the truck reached them (with 1 km of track on each side)
    const passed: { station: number; at: number }[] = [];
    const a = Math.max(1, r.from - 3), b = Math.min(track.length - 1, r.to + 3);
    for (const s of stations) {
      let at = -1;
      for (let i = a; i <= b; i++) if (toSegment(s, track[i - 1], track[i]) <= passM) {
        at = i;
        break;
      }
      if (at >= 0 && !passed.some((p) => p.station === s.station && Math.abs(p.at - at) < 3)) passed.push({ station: s.station, at });
    }
    passed.sort((x, y) => x.at - y.at);
    const seq = passed.map((x) => x.station).filter((st, i, all) => i === 0 || st !== all[i - 1]);
    // station to station along the way: the official list is additive inside one system
    // (Beograd–Jagodina + Jagodina–Niš = Beograd–Niš), and this also pays each barrier between systems
    let p = 0, ok = seq.length >= 2;
    for (let i = 1; i < seq.length && ok; i++) {
      const v = Number(price[seq[i - 1]]?.[seq[i]]) || Number(price[seq[i]]?.[seq[i - 1]]);
      if (!Number.isFinite(v)) ok = false;
      else p += v;
    }
    if (!ok || p <= 0) {
      unpricedKm += r.km;
      continue;
    }
    trips.push({ from: names[seq[0]], to: names[seq[seq.length - 1]], price: p, km: Math.round(r.km * 10) / 10 });
  }
  return { trips, unpricedKm };
}
