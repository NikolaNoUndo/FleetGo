/**
 * Reads a list of places (e.g. Eurowag fuel stations) from the files networks usually
 * hand out: CSV/TXT (with or without a header, incl. Garmin POI "lon,lat,name,desc"),
 * KML (Google Earth) or GPX (navigation). Runs in the browser; the server re-validates.
 */

export type PlaceImportRow = {
  name: string;
  address?: string | null;
  phone?: string | null;
  note?: string | null;
  lat: number;
  lng: number;
  dieselPrice?: number | null;
  priceCurrency?: string | null;
  /** ISO timestamp from the file, if it has a date column */
  priceUpdatedAt?: string | null;
};
/** A price for a station that is already in the list, matched by name (price lists often have no coordinates). */
export type PriceUpdate = { name: string; dieselPrice: number; priceCurrency?: string | null; priceUpdatedAt?: string | null };
/** A row with an address but no coordinates; the browser looks it up before importing. */
export type GeoRow = Omit<PlaceImportRow, "lat" | "lng"> & { street: string; city: string; country: string };
export type ParsedPlaces = {
  rows: PlaceImportRow[];
  updates: PriceUpdate[];
  /** rows that only have an address */
  toGeocode: GeoRow[];
  skipped: number;
  format: "csv" | "kml" | "gpx" | "unknown";
};

/** "1,459", "1.459 €", "195,50 RSD", "1 234,5" → number (+ currency if written next to it) */
export function parsePrice(raw: string | undefined): { value: number; currency: string | null } | null {
  if (!raw) return null;
  let s = raw.trim();
  const cur = s.match(/\b(EUR|RSD|HUF|CZK|PLN|RON|BAM|KM|MKD|CHF|GBP|SEK|DKK|NOK|TRY)\b/i)?.[1]?.toUpperCase() ?? (s.includes("€") ? "EUR" : null);
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const value = Number(s);
  return Number.isFinite(value) && value > 0 ? { value: Math.round(value * 1000) / 1000, currency: cur === "KM" ? "BAM" : cur } : null;
}

/** "2026-09-28", "2026-09-28 14:30", "28.09.2026", "28.09.2026. 14:30", "28/09/2026" → ISO */
export function parseDateTime(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  let parts: number[] | null = m ? [+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0)] : null;
  if (!parts) {
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) parts = [+m[3], +m[2], +m[1], +(m[4] ?? 0), +(m[5] ?? 0)];
  }
  if (!parts) return null;
  const [y, mo, d, h, mi] = parts;
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) || mo > 12 || d > 31 ? null : date.toISOString();
}

const ok = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/* ---------- XML: KML and GPX ---------- */

function parseXml(text: string): ParsedPlaces {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return { rows: [], updates: [], toGeocode: [], skipped: 0, format: "unknown" };
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
    return { rows, updates: [], toGeocode: [], skipped, format: "gpx" };
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
  return { rows, updates: [], toGeocode: [], skipped, format: rows.length || skipped ? "kml" : "unknown" };
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
  name: /(^name$|naziv|^ime$|station|stanica|pumpa|^title$|^poi$|^site$|objekat|^prodavnica|^shop)/i,
  exactName: /^(name|naziv|ime|station name|naziv stanice|naziv pumpe|stanica|pumpa|title)$/i,
  id: /^(id|station id|station code|site id|kod|šifra|sifra|code|broj)$/i,
  price: /(diesel|dizel|nafta|^cena$|^cijena$|^price$|^unit price$|cena po litru|price per l)/i,
  currency: /^(currency|valuta|curr\.?)$/i,
  phone: /(phone|telefon|^tel\.?$|mobile|mob\.?$|kontakt)/i,
  note: /^(napomena|note|notes|radno vreme|radno vrijeme|hours|opening hours)$/i,
  date: /(updated|ažurirano|azurirano|^datum|^date|valid from|važi od|vazi od|last change|izmena|promena)/i,
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
  if (!table.length) return { rows: [], updates: [], toGeocode: [], skipped: 0, format: "unknown" };
  const num = (s: string | undefined) => {
    if (!s) return NaN;
    const v = d === "," ? s : s.replace(",", ".");
    return /^-?\d{1,3}(\.\d+)?$/.test(v) ? Number(v) : NaN;
  };

  const head = table[0];
  const isHeader = head.some((c) => Object.values(H).some((re) => re.test(c))) && !head.some((c) => Number.isFinite(num(c)));
  const rows: PlaceImportRow[] = [];
  const updates: PriceUpdate[] = [];
  const toGeocode: GeoRow[] = [];
  let skipped = 0;

  if (isHeader) {
    const find = (re: RegExp) => head.findIndex((c) => re.test(c));
    // an exact "Name" column wins over e.g. "Station ID"; id/code columns are never the name
    const exact = find(H.exactName);
    const nameCol = exact >= 0 ? exact : head.findIndex((c) => H.name.test(c) && !H.id.test(c) && !H.price.test(c));
    const ci = {
      price: find(H.price),
      phone: find(H.phone),
      currency: find(H.currency),
      date: find(H.date),
      lat: find(H.lat),
      lng: find(H.lng),
      both: find(H.both),
      name: nameCol,
      address: find(H.address),
      city: find(H.city),
      zip: find(H.zip),
      country: find(H.country),
      note: find(H.note),
    };
    for (const r of table.slice(1)) {
      let lat = num(r[ci.lat]);
      let lng = num(r[ci.lng]);
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && ci.both >= 0) {
        const m = (r[ci.both] ?? "").match(/(-?\d{1,3}[.,]\d+)\s*[,; ]\s*(-?\d{1,3}[.,]\d+)/);
        if (m) [lat, lng] = [Number(m[1].replace(",", ".")), Number(m[2].replace(",", "."))];
      }
      // a bare country code ("RS", "BA") adds nothing to a readable address
      const countryText = /^[A-Za-z]{2,3}$/.test(clean(r[ci.country])) ? "" : r[ci.country];
      const address = [r[ci.address], [r[ci.zip], r[ci.city]].filter(Boolean).join(" "), countryText]
        .map((x) => clean(x))
        .filter(Boolean)
        .join(", ");
      const name = clean(r[ci.name]) || clean(r[ci.city]) || clean(r[ci.address]);
      const price = ci.price >= 0 ? parsePrice(r[ci.price]) : null;
      const priceCurrency = price ? (clean(r[ci.currency]).toUpperCase().slice(0, 3) || price.currency) : null;
      const priceUpdatedAt = price && ci.date >= 0 ? parseDateTime(r[ci.date]) : null;
      const extra = { phone: clean(r[ci.phone]) || null, note: clean(r[ci.note]) || null, dieselPrice: price?.value ?? null, priceCurrency, priceUpdatedAt };
      const street = clean(r[ci.address]);
      const city = clean(r[ci.city]);
      if (name && ok(lat, lng)) rows.push({ name, address: address || null, lat, lng, ...extra });
      else if (name && (street || city)) toGeocode.push({ name, address: address || null, street, city, country: clean(r[ci.country]), ...extra });
      else if (name && price) updates.push({ name, dieselPrice: price.value, priceCurrency, priceUpdatedAt });
      else skipped++;
    }
    return { rows, updates, toGeocode, skipped, format: "csv" };
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
  return { rows, updates: [], toGeocode: [], skipped, format: rows.length ? "csv" : "unknown" };
}
