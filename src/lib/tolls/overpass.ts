import "server-only";
import type { LoadStep, TollCountry } from "./countries";
import { rasterize } from "./grid";

/** Public Overpass servers (OpenStreetMap); tried in order. */
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

type OverpassWay = { type: "way"; id: number; geometry?: { lat: number; lon: number }[] };

/** The Overpass query for one step of loading a country: a tile of its network, or a priced stretch. */
export function stepQuery(c: TollCountry, step: LoadStep) {
  if (step.kind === "zone") {
    const [s, w, n, e] = step.zone.bbox;
    return `[out:json][timeout:45];area["ISO3166-1"="${c.code}"][admin_level=2]->.a;way["highway"~"^(motorway|trunk)$"]["ref"~"${step.zone.ref}"](area.a)(${s},${w},${n},${e});out skel geom qt;`;
  }
  return tileQuery(c, step.bbox);
}

/** The Overpass query for one tile of a country's tolled network. */
export function tileQuery(c: TollCountry, [s, w, n, e]: [number, number, number, number]) {
  const hw = c.network === "national" ? `["highway"~"^(motorway|trunk|primary)$"]` : `["highway"~"^(motorway|trunk)$"]`;
  const box = `(area.a)(${s},${w},${n},${e})`;
  const ways =
    c.network === "tagged"
      ? `(way${hw}["toll"="yes"]${box};way${hw}["toll:hgv"="yes"]${box};way${hw}["toll:N3"="yes"]${box};);`
      : c.network === "motorways"
        ? `way${hw}["toll"!="no"]["toll:hgv"!="no"]${box};`
        : `way${hw}${box};`;
  return `[out:json][timeout:45];area["ISO3166-1"="${c.code}"][admin_level=2]->.a;${ways}out skel geom qt;`;
}

/** Ways of one tile → the grid cells they run through, how many ways and their length. */
export function tileCells(json: { elements?: OverpassWay[] }) {
  const cells = new Set<number>();
  let ways = 0, metres = 0;
  for (const el of json.elements ?? []) {
    if (el.type !== "way" || !el.geometry?.length) continue;
    ways++;
    metres += rasterize(el.geometry, cells);
  }
  return { cells, ways, km: metres / 1000 };
}

export async function fetchStep(c: TollCountry, step: LoadStep) {
  const query = stepQuery(c, step);
  let lastErr: unknown = null;
  const deadline = Date.now() + 52_000; // stay inside one server request (60 s)
  for (const url of ENDPOINTS) {
    const left = deadline - Date.now();
    if (left < 8_000) break;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Roadline/1.0 (fleet app; toll network)" },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: AbortSignal.timeout(left),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassWay[]; remark?: string };
      if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(json.remark.slice(0, 160));
      return tileCells(json);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass");
}
