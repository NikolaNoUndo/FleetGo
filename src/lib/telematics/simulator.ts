import type { Position, TrackedVehicle } from "./types";

type City = { name: string; lat: number; lng: number };

const C: Record<string, City> = {
  BG: { name: "Beograd", lat: 44.8125, lng: 20.4612 },
  NS: { name: "Novi Sad", lat: 45.2671, lng: 19.8335 },
  NI: { name: "Niš", lat: 43.3209, lng: 21.8958 },
  SU: { name: "Subotica", lat: 46.1003, lng: 19.6658 },
  KG: { name: "Kragujevac", lat: 44.0128, lng: 20.9114 },
  BUD: { name: "Budimpešta", lat: 47.4979, lng: 19.0402 },
  VIE: { name: "Beč", lat: 48.2082, lng: 16.3738 },
  MUC: { name: "Minhen", lat: 48.1351, lng: 11.582 },
  LJU: { name: "Ljubljana", lat: 46.0569, lng: 14.5058 },
  ZAG: { name: "Zagreb", lat: 45.815, lng: 15.9819 },
  SOF: { name: "Sofija", lat: 42.6977, lng: 23.3219 },
  SKG: { name: "Solun", lat: 40.6401, lng: 22.9444 },
  TIM: { name: "Temišvar", lat: 45.7489, lng: 21.2087 },
  SKP: { name: "Skoplje", lat: 41.9981, lng: 21.4254 },
  GRZ: { name: "Grac", lat: 47.0707, lng: 15.4395 },
  MIL: { name: "Milano", lat: 45.4642, lng: 9.19 },
  BRA: { name: "Bratislava", lat: 48.1486, lng: 17.1077 },
};

// Multi-leg corridors so trucks follow roughly realistic motorway paths.
const ROUTES: string[][] = [
  ["BG", "NS", "SU", "BUD", "VIE"],
  ["BG", "NI", "SOF"],
  ["BG", "NI", "SKP", "SKG"],
  ["NS", "SU", "BUD", "BRA"],
  ["BG", "ZAG", "LJU", "MIL"],
  ["BG", "NS", "SU", "BUD", "VIE", "MUC"],
  ["BG", "TIM"],
  ["BG", "KG", "NI"],
  ["NS", "ZAG", "LJU", "GRZ"],
  ["BG", "NS", "SU", "BUD"],
  ["BG", "ZAG"],
  ["NI", "SOF"],
];

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function nearest(p: { lat: number; lng: number }) {
  let best: City = C.BG;
  let bd = Infinity;
  for (const c of Object.values(C)) {
    const d = dist(p, c);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return { city: best, km: bd };
}

/**
 * Deterministic simulation: position is a pure function of vehicle id and time,
 * so every request (and every server instance) agrees on where a truck is.
 */
export function simulate(vehicles: TrackedVehicle[], now = Date.now()): Position[] {
  return vehicles.map((v) => {
    const h = hash(v.id);
    const base = { unitId: `sim-${v.id.slice(0, 8)}`, unitName: v.plate, vehicleId: v.id };

    // Inactive / in-service vehicles stay parked at the depot.
    if (v.status && v.status !== "active") {
      const depot = h % 2 ? C.BG : C.NS;
      return {
        ...base,
        lat: depot.lat + ((h % 100) - 50) / 20000,
        lng: depot.lng + (((h >> 8) % 100) - 50) / 20000,
        speed: 0,
        course: 0,
        ts: now - (h % 50) * 60000 - 2 * 3600000,
        state: v.status === "inactive" ? "offline" : "stopped",
        place: depot.name,
      } satisfies Position;
    }

    const route = ROUTES[h % ROUTES.length].map((k) => C[k]);
    const path = [...route, ...route.slice(0, -1).reverse()]; // there and back
    const speed = 68 + (h % 14); // km/h cruising
    const stopMin = 35 + (h % 40); // minutes stopped at each waypoint
    const legs = path.slice(0, -1).map((a, i) => ({ a, b: path[i + 1], km: dist(a, path[i + 1]) }));
    const legMs = legs.map((l) => (l.km / speed) * 3600000 + stopMin * 60000);
    const cycle = legMs.reduce((s, x) => s + x, 0);
    let t = (now + (h % 1000) * 97000) % cycle;

    for (let i = 0; i < legs.length; i++) {
      if (t > legMs[i]) {
        t -= legMs[i];
        continue;
      }
      const l = legs[i];
      const driveMs = legMs[i] - stopMin * 60000;
      if (t > driveMs) {
        return { ...base, lat: l.b.lat, lng: l.b.lng, speed: 0, course: bearing(l.a, l.b), ts: now - 20000, state: "stopped", place: l.b.name } satisfies Position;
      }
      const f = t / driveMs;
      // small lateral wobble so lines look less like a ruler
      const wobble = Math.sin(f * Math.PI * 3 + h) * 0.04 * Math.sin(f * Math.PI);
      const lat = l.a.lat + (l.b.lat - l.a.lat) * f + wobble;
      const lng = l.a.lng + (l.b.lng - l.a.lng) * f - wobble;
      const n = nearest({ lat, lng });
      const s = Math.round(speed + Math.sin(now / 60000 + h) * 6);
      return {
        ...base,
        lat,
        lng,
        speed: s,
        course: bearing(l.a, l.b),
        ts: now - ((h >> 4) % 30) * 1000,
        state: "moving",
        place: n.km < 35 ? n.city.name : `${l.a.name} → ${l.b.name}`,
      } satisfies Position;
    }
    return { ...base, lat: C.BG.lat, lng: C.BG.lng, speed: 0, course: 0, ts: now, state: "stopped", place: C.BG.name } satisfies Position;
  });
}
