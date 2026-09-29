"use client";

import type { GeoRow, PlaceImportRow } from "./place-import";

/**
 * Finds coordinates for imported rows that only have an address, straight from the
 * browser via OpenStreetMap Nominatim (allows browser requests; max 1 per second).
 * If the street isn't found, the city is used and the place is marked approximate.
 */

const COUNTRY: Record<string, string> = {
  rs: "rs", srb: "rs", srbija: "rs", serbia: "rs",
  ba: "ba", bih: "ba", bosna: "ba", "bosna i hercegovina": "ba", "bosnia and herzegovina": "ba", republika: "ba",
  me: "me", "crna gora": "me", montenegro: "me",
  hr: "hr", hrvatska: "hr", croatia: "hr",
  mk: "mk", "severna makedonija": "mk", "north macedonia": "mk",
  hu: "hu", "mađarska": "hu", madjarska: "hu", hungary: "hu",
  ro: "ro", rumunija: "ro", romania: "ro",
  bg: "bg", bugarska: "bg", bulgaria: "bg",
  si: "si", slovenija: "si", slovenia: "si",
};

const countryCode = (c: string) => COUNTRY[c.trim().toLowerCase()] ?? (/^[a-z]{2}$/i.test(c.trim()) ? c.trim().toLowerCase() : "");

async function lookup(q: string, cc: string, signal: AbortSignal): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=sr${cc ? `&countrycodes=${cc}` : ""}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as { lat: string; lon: string }[];
  if (!j[0]) return null;
  const lat = Number(j[0].lat);
  const lng = Number(j[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new DOMException("aborted", "AbortError"));
    });
  });

export type GeoResult = { found: (PlaceImportRow & { approx: boolean })[]; missing: GeoRow[] };

export async function geocodeRows(rows: GeoRow[], onProgress: (done: number) => void, signal: AbortSignal): Promise<GeoResult> {
  const found: GeoResult["found"] = [];
  const missing: GeoRow[] = [];
  let first = true;
  const polite = async () => {
    if (!first) await wait(1100, signal);
    first = false;
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cc = countryCode(r.country);
    let hit: { lat: number; lng: number } | null = null;
    let approx = false;
    const { street, city, country, ...rest } = r;
    // "bb" (bez broja) and similar confuse the search; drop it
    const s = street.replace(/\bbb\b\.?/gi, "").replace(/\s+,/g, ",").trim();
    if (s) {
      await polite();
      hit = await lookup([s, city].filter(Boolean).join(", "), cc, signal).catch(() => null);
    }
    if (!hit && city) {
      await polite();
      hit = await lookup(city, cc, signal).catch(() => null);
      approx = !!hit && !!s;
    }
    if (hit) {
      const note = approx ? [rest.note, "lokacija približna (grad)"].filter(Boolean).join(" · ") : rest.note;
      found.push({ ...rest, note, lat: hit.lat, lng: hit.lng, approx });
    } else missing.push(r);
    void country;
    onProgress(i + 1);
  }
  return { found, missing };
}
