import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { RAMP_SYSTEMS, stationPoints } from "./ramps";
import { RS_SNAPSHOT, RS_SNAPSHOT_DATE } from "./rs-snapshot";

const HEADERS = { "User-Agent": "Roadline/1.0 (fleet app; toll prices)", Accept: "text/html,application/javascript,*/*" };

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

type PriceList = { names: string[]; prices: Record<string, number[][]>; currency: string };

/** The official Serbian price list (closed system and Belgrade bypass), straight from Putevi Srbije. */
export async function fetchSerbianPrices(timeoutMs = 20000): Promise<Record<string, PriceList | null>> {
  let html = "";
  for (const url of PS_PAGES) {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
    if (res?.ok) {
      html = await res.text();
      if (/dist\[0\]/.test(html)) break;
    }
  }
  if (!/dist\[0\]/.test(html)) throw new Error("Cenovnik Puteva Srbije nije pronađen na njihovom sajtu.");
  const js = await fetch(PS_JS, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) }).then((r) => r.text());
  const main = matrixRows(html, "dist"), bypass = matrixRows(html, "dist1");
  const city = nameList(js, "city"), petlja = nameList(js, "petlja");
  if (city.length < 20 || main.length !== city.length) throw new Error(`Cenovnik nije u očekivanom obliku (${city.length} stanica, ${main.length} redova).`);
  // sanity: Beograd → Niš jug has to be there, or the format changed under us
  const b = city.indexOf("Beograd"), n = city.indexOf("Niš jug");
  if (b < 0 || n < 0 || !(category(main, 4)[b]?.[n] > 0)) throw new Error("Cenovnik se ne čita kako treba (nema cene Beograd – Niš jug).");
  const cats = (rows: number[][]) => ({ II: category(rows, 2), III: category(rows, 3), IV: category(rows, 4) });
  return {
    RS: { names: city, prices: cats(main), currency: "RSD" },
    "RS-OB": petlja.length && bypass.length === petlja.length ? { names: petlja, prices: cats(bypass), currency: "RSD" } : null,
  };
}

/* ---------------------------------------------------------------- refresh and status */

async function store(key: string, list: PriceList) {
  const sys = RAMP_SYSTEMS.find((s) => s.key === key)!;
  const { missing } = stationPoints(sys.stations, list.names);
  const row = { names: list.names, prices: list.prices, currency: list.currency, source: sys.source, found: list.names.length - missing.length, missing, fetchedAt: new Date() };
  await db.insert(schema.tollPrices).values({ system: key, ...row }).onConflictDoUpdate({ target: schema.tollPrices.system, set: row });
  // station points used to come from the map server; the app keeps them now
  await db.delete(schema.tollRamps).where(eq(schema.tollRamps.system, key));
  return { key, stations: list.names.length, found: row.found, missing };
}

/** Fetches the official price list for every ramp system of a country and stores it. */
export async function refreshRamps(country: string, timeoutMs = 20000) {
  if (country !== "RS") throw new Error("Za ovu zemlju cenovnik od rampe do rampe još nije podržan.");
  const lists = await fetchSerbianPrices(timeoutMs);
  const out = [];
  for (const sys of RAMP_SYSTEMS.filter((x) => x.country === country)) {
    const list = lists[sys.key];
    if (list) out.push(await store(sys.key, list));
  }
  return out;
}

export async function rampStatus() {
  const rows = await db.select({ system: schema.tollPrices.system, names: schema.tollPrices.names, fetchedAt: schema.tollPrices.fetchedAt }).from(schema.tollPrices);
  return RAMP_SYSTEMS.map((s) => {
    const r = rows.find((x) => x.system === s.key);
    const names = r?.names ?? RS_SNAPSHOT[s.key as keyof typeof RS_SNAPSHOT]?.names ?? [];
    const { missing } = stationPoints(s.stations, names);
    return { key: s.key, country: s.country, name: s.name.sr, stations: names.length, found: names.length - missing.length, missing, fetchedAt: r?.fetchedAt.toISOString() ?? null, snapshot: RS_SNAPSHOT_DATE };
  });
}

/* ---------------------------------------------------------------- for a calculation */

const FRESH_MS = 30 * 86400_000;

/**
 * Everything a calculation needs for a country's ramp systems: the stored official list,
 * refreshed from the operator's site when it's older than a month (or not there yet), and the
 * copy kept in the app when the site can't be reached. Never empty for a country the app
 * prices by ramp, so such a country is never priced per km.
 */
export async function rampData(country: string) {
  const systems = RAMP_SYSTEMS.filter((s) => s.country === country);
  if (!systems.length) return [];
  let rows = await db.select().from(schema.tollPrices);
  if (systems.some((s) => { const r = rows.find((x) => x.system === s.key); return !r || !r.prices.II || Date.now() - r.fetchedAt.getTime() > FRESH_MS; })) {
    try {
      await refreshRamps(country, 8000);
      rows = await db.select().from(schema.tollPrices);
    } catch {
      // the stored list (or the app's copy) carries on
    }
  }
  return systems.map((s) => {
    const r = rows.find((x) => x.system === s.key);
    const snap = RS_SNAPSHOT[s.key as keyof typeof RS_SNAPSHOT];
    const list = r && r.prices.II ? { names: r.names, prices: r.prices, currency: r.currency, fetchedAt: r.fetchedAt, live: true } : { ...snap, fetchedAt: new Date(RS_SNAPSHOT_DATE), live: false };
    return { system: s, ...list, stations: stationPoints(s.stations, list.names).points };
  });
}
