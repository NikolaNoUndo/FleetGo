/**
 * Coordinates for map places: parse what people paste ("44.81, 20.46", a Google Maps
 * link, a maps.app.goo.gl short link) or look the address up in OpenStreetMap.
 */

export type LatLng = { lat: number; lng: number };

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

export function validLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function pair(a: string, b: string): LatLng | null {
  const lat = Number(a);
  const lng = Number(b);
  return validLatLng(lat, lng) ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 } : null;
}

/** "44.81, 20.46", "44.81 20.46", "44,81; 20,46" or coordinates inside a map link. */
export function parseCoords(input: string): LatLng | null {
  let s = input.trim();
  if (!s) return null;
  try {
    // links arrive URL-encoded, sometimes twice (consent redirects)
    s = decodeURIComponent(decodeURIComponent(s));
  } catch {
    /* keep as is */
  }
  // Google: the pin itself (!3d…!4d…) is more exact than the camera (@lat,lng)
  const patterns = [
    new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
    new RegExp(String.raw`[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?${NUM},\s*${NUM}`),
    new RegExp(String.raw`@${NUM},${NUM}`),
    new RegExp(String.raw`/(?:place|search|dir)/${NUM},\s*${NUM}`),
    // OpenStreetMap: #map=zoom/lat/lng or ?mlat=..&mlon=..
    new RegExp(String.raw`#map=\d+/${NUM}/${NUM}`),
    new RegExp(String.raw`mlat=${NUM}&mlon=${NUM}`),
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const p = pair(m[1], m[2]);
      if (p) return p;
    }
  }
  // plain pair; a decimal comma is allowed when the separator is ";" or whitespace
  const plain = s.match(/^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (plain) {
    const [a, b] = [plain[1], plain[2]];
    // "44,81, 20,46" is ambiguous and not matched above; "44.81,20.46" is fine
    return pair(a.replace(",", "."), b.replace(",", "."));
  }
  const loose = s.match(/^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  return loose ? pair(loose[1], loose[2]) : null;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await run(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Short links (maps.app.goo.gl, goo.gl/maps) only reveal coordinates after the redirect. */
async function expandLink(url: string): Promise<string | null> {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (!/(^|\.)(goo\.gl|app\.goo\.gl|google\.[a-z.]+)$/.test(host)) return null;
  try {
    return await withTimeout(6000, async (signal) => {
      const r = await fetch(url, { redirect: "follow", signal, headers: { "User-Agent": "Mozilla/5.0 (Roadline)" } });
      if (parseCoords(r.url)) return r.url;
      // some redirects end on a page that carries the full link in its HTML
      const html = (await r.text()).slice(0, 200_000);
      const m = html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s<>]+/);
      return m ? m[0] : r.url;
    });
  } catch {
    return null;
  }
}

/** Address → coordinates via OpenStreetMap Nominatim (low volume, one lookup per save). */
export async function geocode(address: string): Promise<LatLng | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    return await withTimeout(7000, async (signal) => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, {
        signal,
        headers: { "User-Agent": "Roadline/0.2 (fleet management; places on map)", "Accept-Language": "sr,en" },
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { lat: string; lon: string }[];
      return j[0] ? pair(j[0].lat, j[0].lon) : null;
    });
  } catch {
    return null;
  }
}

/**
 * What the form's "Coordinates" field resolves to: typed coordinates, a map link
 * (short links are expanded) or, when the field is empty, the address.
 */
export async function resolveLocation(coords: string, address: string): Promise<LatLng | null> {
  const c = coords.trim();
  if (c) {
    const direct = parseCoords(c);
    if (direct) return direct;
    if (isUrl(c)) {
      const long = await expandLink(c);
      return long ? parseCoords(long) : null;
    }
    // not coordinates and not a link: treat it as a place name / address
    return geocode(c);
  }
  return geocode(address);
}
