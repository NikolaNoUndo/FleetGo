/**
 * Reads a list of places (e.g. Eurowag fuel stations) from the files networks usually
 * hand out: CSV/TXT (with or without a header, incl. Garmin POI "lon,lat,name,desc"),
 * KML (Google Earth) or GPX (navigation). Runs in the browser; the server re-validates.
 */

export type PlaceImportRow = { name: string; address?: string | null; lat: number; lng: number };
export type ParsedPlaces = { rows: PlaceImportRow[]; skipped: number; format: "csv" | "kml" | "gpx" | "unknown" };

const ok = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/* ---------- XML: KML and GPX ---------- */

function parseXml(text: string): ParsedPlaces {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return { rows: [], skipped: 0, format: "unknown" };
  const rows: PlaceImportRow[] = [];
  let skipped = 0;
  const child = (el: Element, tag: string) => clean(el.getElementsByTagName(tag)[0]?.textContent);

  const wpts = [...doc.getElementsByTagName("wpt")];
  if (wpts.length) {
    for (const w of wpts) {
      const lat = Number(w.getAttribute("lat"));
      const lng = Number(w.getAttribute("lon"));
      const name = child(w, "name");
      if (!ok(lat, lng) || !name) skipped++;
      else rows.push({ name, address: child(w, "desc") || child(w, "cmt") || null, lat, lng });
    }
    return { rows, skipped, format: "gpx" };
  }

  for (const pm of [...doc.getElementsByTagName("Placemark")]) {
    const coords = child(pm, "coordinates").split(/\s+/)[0]?.split(",") ?? [];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    const name = child(pm, "name");
    // descriptions are often HTML; keep the text only
    const desc = clean((child(pm, "address") || child(pm, "description")).replace(/<[^>]+>/g, " "));
    if (!ok(lat, lng) || !name) skipped++;
    else rows.push({ name, address: desc || null, lat, lng });
  }
  return { rows, skipped, format: rows.length || skipped ? "kml" : "unknown" };
}

/* ---------- CSV ---------- */

function detectDelimiter(line: string): string {
  let best = ",";
  let max = -1;
  for (const d of [";", "\t", ",", "|"]) {
    let n = 0;
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (!q && ch === d) n++;
    }
    if (n > max) [best, max] = [d, n];
  }
  return best;
}

function splitCsv(text: string, d: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const H = {
  lat: /^(lat|latitude|geo_?lat|gps_?lat|y|sirina|širina|geografska sirina)$/i,
  lng: /^(lng|lon|long|longitude|geo_?lng|geo_?lon|gps_?lon|gps_?lng|x|duzina|dužina|geografska duzina)$/i,
  both: /^(coord|coords|coordinates|koordinate|gps|location|lokacija|lat ?, ?lng|lat ?, ?lon)$/i,
  name: /(^name$|naziv|^ime$|station|stanica|pumpa|^title$|^poi$|site|objekat|^prodavnica|^shop)/i,
  address: /(address|adresa|street|ulica)/i,
  city: /(^city$|grad|mesto|town|place|locality)/i,
  zip: /(zip|postal|post code|poštanski|postanski|^ptt$)/i,
  country: /(country|država|drzava|zemlja)/i,
};

export function parsePlacesFile(input: string): ParsedPlaces {
  const text = input.replace(/^﻿/, "");
  if (/^\s*</.test(text)) return parseXml(text);

  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const d = detectDelimiter(firstLine);
  const table = splitCsv(text, d).map((r) => r.map((c) => c.trim()));
  if (!table.length) return { rows: [], skipped: 0, format: "unknown" };
  const num = (s: string | undefined) => {
    if (!s) return NaN;
    const v = d === "," ? s : s.replace(",", ".");
    return /^-?\d{1,3}(\.\d+)?$/.test(v) ? Number(v) : NaN;
  };

  const head = table[0];
  const isHeader = head.some((c) => Object.values(H).some((re) => re.test(c))) && !head.some((c) => Number.isFinite(num(c)));
  const rows: PlaceImportRow[] = [];
  let skipped = 0;

  if (isHeader) {
    const find = (re: RegExp) => head.findIndex((c) => re.test(c));
    const ci = {
      lat: find(H.lat),
      lng: find(H.lng),
      both: find(H.both),
      name: find(H.name),
      address: find(H.address),
      city: find(H.city),
      zip: find(H.zip),
      country: find(H.country),
    };
    for (const r of table.slice(1)) {
      let lat = num(r[ci.lat]);
      let lng = num(r[ci.lng]);
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && ci.both >= 0) {
        const m = (r[ci.both] ?? "").match(/(-?\d{1,3}[.,]\d+)\s*[,; ]\s*(-?\d{1,3}[.,]\d+)/);
        if (m) [lat, lng] = [Number(m[1].replace(",", ".")), Number(m[2].replace(",", "."))];
      }
      const address = [r[ci.address], [r[ci.zip], r[ci.city]].filter(Boolean).join(" "), r[ci.country]]
        .map((x) => clean(x))
        .filter(Boolean)
        .join(", ");
      const name = clean(r[ci.name]) || clean(r[ci.city]) || clean(r[ci.address]);
      if (!ok(lat, lng) || !name) skipped++;
      else rows.push({ name, address: address || null, lat, lng });
    }
    return { rows, skipped, format: "csv" };
  }

  // No header (Garmin POI and similar): two number columns + text columns.
  const europeLat = (v: number) => v >= 34 && v <= 72;
  for (const r of table) {
    const idx = r.map((c, i) => (Number.isFinite(num(c)) ? i : -1)).filter((i) => i >= 0);
    const texts = r.filter((c, i) => !idx.includes(i) && c);
    if (idx.length < 2 || !texts.length) {
      skipped++;
      continue;
    }
    const a = num(r[idx[0]]);
    const b = num(r[idx[1]]);
    // Garmin order is lon,lat; switch when only the first value looks like a European latitude
    const [lat, lng] = europeLat(a) && !europeLat(b) ? [a, b] : [b, a];
    if (!ok(lat, lng)) skipped++;
    else rows.push({ name: clean(texts[0]), address: clean(texts.slice(1).join(", ")) || null, lat, lng });
  }
  return { rows, skipped, format: rows.length ? "csv" : "unknown" };
}
