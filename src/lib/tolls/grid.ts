/**
 * The tolled network is kept as a set of grid cells of 0.001° (≈ 111 m north–south,
 * ≈ 80 m east–west in our latitudes). A road is stored as the cells it runs through;
 * a GPS point is on it when its own cell or a neighbouring one is stored.
 */
export const CELL_DEG = 0.001;
const LON_CELLS = 360_000; // 360° / 0.001

export const cellOf = (lat: number, lon: number) => Math.floor((lat + 90) / CELL_DEG) * LON_CELLS + Math.floor((lon + 180) / CELL_DEG);

/** the cell and its 8 neighbours */
export function cellsAround(lat: number, lon: number): number[] {
  const r = Math.floor((lat + 90) / CELL_DEG), c = Math.floor((lon + 180) / CELL_DEG);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) out.push((r + dr) * LON_CELLS + (c + dc));
  return out;
}

/** metres between two points */
export function distM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLon = (bLon - aLon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cells a polyline runs through, sampled every ~30 m; also returns its length in metres. */
export function rasterize(line: { lat: number; lon: number }[], into: Set<number>): number {
  let len = 0;
  for (let i = 0; i < line.length; i++) {
    const p = line[i];
    into.add(cellOf(p.lat, p.lon));
    if (i === 0) continue;
    const q = line[i - 1];
    const d = distM(q.lat, q.lon, p.lat, p.lon);
    len += d;
    const steps = Math.ceil(d / 30);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      into.add(cellOf(q.lat + (p.lat - q.lat) * t, q.lon + (p.lon - q.lon) * t));
    }
  }
  return len;
}
