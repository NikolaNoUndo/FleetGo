import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { matchStations, rampSystem, RAMP_SYSTEMS } from "./ramps";

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const UA = { "User-Agent": "Roadline/1.0 (fleet app; toll stations)" };

/* ---------------------------------------------------------------- Serbia (Putevi Srbije) */

const PS_PAGES = ["https://www.putevi-srbije.rs/index.php/en/kategorizacija-vozila-cenovnik-putarine-2", "https://www.putevi-srbije.rs/index.php/sr/kategorizacija-vozila-cenovnik-putarine"];
const PS_JS = "https://www.putevi-srbije.rs/cenovnici/dist.js";

/** The rows of `name[i] = ["0.00", …];` in a page, as numbers. */
function matrixRows(html: string, name: string) {
  const rows: number[][] = [];
  const re = new RegExp(`${name}\\[(\\d+)\\]\\s*=\\s*\\[([^\\]]*)\\]`, "g");
  for (const m of html.matchAll(re)) rows[Number(m[1])] = m[2].split(",").map((x) => Number(x.replace(/["'\s]/g, "")));
  return rows;
}
/** `var city = [['Subotica'], …]` → ["Subotica", …] */
function nameList(js: string, name: string) {
  const block = js.match(new RegExp(`var ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`))?.[1] ?? "";
  return [...block.matchAll(/\[\s*'([^']+)'\s*\]/g)].map((m) => m[1].replace(/^petlja\s+/i, "").trim());
}
/** a row holds 5 prices per destination: Ia, I, II, III, IV */
const category = (rows: number[][], col: number) => rows.map((r) => Array.from({ length: Math.floor(r.length / 5) }, (_, j) => r[j * 5 + col]));

/** The official Serbian price list (both the closed system and the Belgrade bypass), straight from Putevi Srbije. */
export async function fetchSerbianPrices() {
  let html = "";
  for (const url of PS_PAGES) {
    const res = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (res?.ok) {
      html = await res.text();
      if (/dist\[0\]/.test(html)) break;
    }
  }
  if (!/dist\[0\]/.test(html)) throw new Error("Cenovnik Puteva Srbije nije pronađen na njihovom sajtu.");
  const js = await fetch(PS_JS, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(20000) }).then((r) => r.text());
  const main = matrixRows(html, "dist"), bypass = matrixRows(html, "dist1");
  const city = nameList(js, "city"), petlja = nameList(js, "petlja");
  if (city.length < 20 || main.length !== city.length) throw new Error(`Cenovnik nije u očekivanom obliku (${city.length} stanica, ${main.length} redova).`);
  return {
    RS: { names: city, prices: { III: category(main, 3), IV: category(main, 4) }, currency: "RSD" },
    "RS-OB": petlja.length && bypass.length === petlja.length ? { names: petlja, prices: { III: category(bypass, 3), IV: category(bypass, 4) }, currency: "RSD" } : null,
  };
}

/* ---------------------------------------------------------------- stations from OpenStreetMap */

type OsmEl = { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

async function overpass(query: string) {
  let last: unknown = null;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: query }), cache: "no-store", signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      return ((await res.json()) as { elements: OsmEl[] }).elements;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Overpass");
}

export async function fetchStationPoints(key: string) {
  const s = rampSystem(key);
  if (!s) throw new Error("system");
  const bb = `(${s.bbox.join(",")})`;
  const q =
    s.stationTag === "toll_booth"
      ? `[out:json][timeout:25];(node["barrier"="toll_booth"]${bb};way["barrier"="toll_booth"]${bb};node["highway"="motorway_junction"]["name"]${bb};);out center tags;`
      : `[out:json][timeout:25];node["highway"="motorway_junction"]${bb};out tags;`;
  const els = await overpass(q);
  return els
    .map((e) => ({ name: e.tags?.["name:sr-Latn"] ?? e.tags?.name ?? e.tags?.["name:sr"] ?? "", lat: e.lat ?? e.center?.lat ?? NaN, lon: e.lon ?? e.center?.lon ?? NaN }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

/* ---------------------------------------------------------------- refresh (admin) */

/** Fetches the official price list and finds its stations on the map, for every ramp system of a country. */
export async function refreshRamps(country: string) {
  if (country !== "RS") throw new Error("Za ovu zemlju cenovnik od rampe do rampe još nije podržan.");
  const lists = await fetchSerbianPrices();
  const out: { key: string; stations: number; found: number; missing: string[] }[] = [];
  for (const sys of RAMP_SYSTEMS.filter((x) => x.country === country)) {
    const list = lists[sys.key as keyof typeof lists];
    if (!list) continue;
    const points = await fetchStationPoints(sys.key);
    const { points: matched, missing } = matchStations(list.names, points);
    await db.transaction(async (tx) => {
      await tx.delete(schema.tollRamps).where(eq(schema.tollRamps.system, sys.key));
      for (let i = 0; i < matched.length; i += 500) await tx.insert(schema.tollRamps).values(matched.slice(i, i + 500).map((p) => ({ system: sys.key, station: p.station, lat: p.lat, lon: p.lon })));
      const row = { names: list.names, prices: list.prices, currency: list.currency, source: sys.source, found: list.names.length - missing.length, missing, fetchedAt: new Date() };
      await tx.insert(schema.tollPrices).values({ system: sys.key, ...row }).onConflictDoUpdate({ target: schema.tollPrices.system, set: row });
    });
    out.push({ key: sys.key, stations: list.names.length, found: list.names.length - missing.length, missing });
  }
  return out;
}

export async function rampStatus() {
  const rows = await db.select({ system: schema.tollPrices.system, found: schema.tollPrices.found, names: schema.tollPrices.names, missing: schema.tollPrices.missing, fetchedAt: schema.tollPrices.fetchedAt }).from(schema.tollPrices);
  return RAMP_SYSTEMS.map((s) => {
    const r = rows.find((x) => x.system === s.key);
    return { key: s.key, country: s.country, name: s.name.sr, stations: r?.names.length ?? 0, found: r?.found ?? 0, missing: r?.missing ?? [], fetchedAt: r?.fetchedAt.toISOString() ?? null };
  });
}

/** Everything a calculation needs for one country's ramp systems (null when not loaded yet). */
export async function rampData(country: string) {
  const systems = RAMP_SYSTEMS.filter((s) => s.country === country);
  const out = [];
  for (const s of systems) {
    const [p] = await db.select().from(schema.tollPrices).where(eq(schema.tollPrices.system, s.key)).limit(1);
    if (!p) continue;
    const stations = await db.select({ station: schema.tollRamps.station, lat: schema.tollRamps.lat, lon: schema.tollRamps.lon }).from(schema.tollRamps).where(eq(schema.tollRamps.system, s.key));
    out.push({ system: s, names: p.names, prices: p.prices, currency: p.currency, fetchedAt: p.fetchedAt, stations });
  }
  return out;
}
