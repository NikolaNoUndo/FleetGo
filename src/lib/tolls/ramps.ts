/**
 * "Ramp to ramp" tolling (closed systems): you pay for the pair of stations where you got
 * on and off the motorway, from the operator's price list — never by the km. Serbia now;
 * Croatia, France, Spain and the Polish concessions work the same way and come next.
 */
import { distM } from "./grid";
import { RS_BYPASS_STATIONS, RS_STATIONS } from "./rs-stations";

export type RampSystem = {
  key: string;
  country: string;
  name: { sr: string; en: string };
  /** where its stations are, by price-list name */
  stations: Record<string, [number, number][]>;
  /** a GPS track passing closer than this to a station point went through it */
  passM: number;
  /** price-list category for a combination with this many axles */
  category: (axles: number) => string;
  source: string;
};

/** Putevi Srbije: II = two axles, III = three, IV = four or more (truck + trailer together). */
const srCategory = (axles: number) => (axles >= 4 ? "IV" : axles === 3 ? "III" : "II");

export const RAMP_SYSTEMS: RampSystem[] = [
  {
    key: "RS",
    country: "RS",
    name: { sr: "Srbija, naplatne stanice", en: "Serbia, toll stations" },
    stations: RS_STATIONS,
    passM: 350,
    category: srCategory,
    source: "https://www.putevi-srbije.rs/index.php/sr/kategorizacija-vozila-cenovnik-putarine",
  },
  {
    key: "RS-OB",
    country: "RS",
    name: { sr: "Obilaznica oko Beograda", en: "Belgrade bypass" },
    stations: RS_BYPASS_STATIONS,
    passM: 450,
    category: srCategory,
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
 * The stations of a price list on the map, from the coordinates kept in the app (by the
 * list's own names, so a reordered or extended list still lines up). Returns the names it
 * has no place for.
 */
export function stationPoints(table: Record<string, [number, number][]>, names: string[]) {
  const byNorm = new Map(Object.entries(table).map(([k, v]) => [normName(k), v]));
  const points: { station: number; lat: number; lon: number }[] = [];
  const missing: string[] = [];
  names.forEach((n, i) => {
    const at = table[n] ?? byNorm.get(normName(n));
    if (!at) missing.push(n);
    else for (const [lat, lon] of at) points.push({ station: i, lat, lon });
  });
  return { points, missing };
}

/** price from a to b in the official list (either direction: the list fills only one side for some pairs) */
const pairPrice = (price: number[][], a: number, b: number) => {
  const v = Number(price[a]?.[b]) || Number(price[b]?.[a]);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * One trip per stretch the truck drove on this system's network, priced the way the
 * operator's calculator does: entry station → exit station, straight from the official list.
 * `seg[i]` is the network key of the step from point i-1 to i (null off the network).
 *
 * The stations the truck went through are read off the track in order; a stretch whose first
 * or last station is just off the track gets the nearest one within 3 km. A station showing up
 * again means the truck turned back, so each direction is its own trip. Where the list has no
 * price for the pair (two systems in a row, a half interchange) it's added up station by
 * station. A stretch that touched fewer than two stations (a free city section, a gap in
 * tracking) can't be priced and comes back in `unpriced`, never as a per-km guess.
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
  const unpriced: { km: number; stations: number }[] = [];
  /** metres along the track up to each point */
  const cum = [0];
  for (let i = 1; i < track.length; i++) cum.push(cum[i - 1] + distM(track[i - 1].lat, track[i - 1].lon, track[i].lat, track[i].lon));
  for (const r of runs) {
    if (r.km < 1) continue;
    // every time the track comes within reach of a station point counts as one pass
    const a = Math.max(1, r.from - 3), b = Math.min(track.length - 1, r.to + 3);
    const passed: { station: number; at: number }[] = [];
    for (const s of stations) {
      let inside = false;
      for (let i = a; i <= b; i++) {
        const near = toSegment(s, track[i - 1], track[i]) <= passM;
        if (near && !inside) passed.push({ station: s.station, at: i });
        inside = near;
      }
    }
    passed.sort((x, y) => x.at - y.at);
    let seq = passed.filter((p, i, all) => i === 0 || p.station !== all[i - 1].station);
    // the stretch began or ended next to a station the track just missed
    const nearest = (i: number) => {
      let best = -1, bd = 3000;
      for (const s of stations) {
        const d = distM(track[i].lat, track[i].lon, s.lat, s.lon);
        if (d < bd) (bd = d), (best = s.station);
      }
      return best;
    };
    const head = nearest(r.from), tail = nearest(r.to);
    if (head >= 0 && seq[0]?.station !== head) seq = [{ station: head, at: r.from }, ...seq];
    if (tail >= 0 && seq[seq.length - 1]?.station !== tail) seq = [...seq, { station: tail, at: r.to }];

    // a station showing up again means the truck turned back: each direction is its own trip
    const legs: (typeof seq)[] = [];
    let leg: typeof seq = [];
    for (const p of seq) {
      if (leg.some((x) => x.station === p.station)) {
        legs.push(leg);
        leg = [leg[leg.length - 1]];
      }
      leg.push(p);
    }
    legs.push(leg);

    let priced = false;
    for (const l of legs) {
      if (l.length < 2) continue;
      const first = l[0], last = l[l.length - 1];
      // entry → exit straight from the list, like the operator's calculator
      let total = pairPrice(price, first.station, last.station);
      let end = last;
      if (!total) {
        // the list has no such pair (two systems, a half interchange): station by station,
        // skipping a station it has no price for from here
        let from = first;
        for (let i = 1; i < l.length; i++) {
          const v = pairPrice(price, from.station, l[i].station);
          if (!v) continue;
          total += v;
          from = end = l[i];
        }
      }
      if (total <= 0) continue;
      priced = true;
      trips.push({ from: names[first.station], to: names[end.station], price: total, km: Math.round((cum[end.at] - cum[first.at]) / 100) / 10 });
    }
    if (!priced) unpriced.push({ km: Math.round(r.km * 10) / 10, stations: seq.length });
  }
  return { trips, unpriced, unpricedKm: unpriced.reduce((s, u) => s + u.km, 0) };
}
