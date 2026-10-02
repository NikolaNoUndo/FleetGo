import type { Position, TrackedVehicle, WialonConfig } from "./types";

/**
 * Wialon Remote API connector (Wialon Hosting or Wialon Local).
 * Docs: https://sdk.wialon.com/wiki/en/sidebar/remoteapi/apiref/apiref
 *
 * Every company stores its own token (and optional Wialon Local host) in Settings.
 */

type WialonUnit = {
  id: number;
  nm: string;
  /** hardware unique ID (IMEI etc.) – "Unique ID" on the unit's Hardware tab */
  uid?: string;
  pos?: { t: number; y: number; x: number; s: number; c: number } | null;
  /** last message; `p` holds the device's raw parameters (CAN odometer among them) */
  lmsg?: { t?: number; p?: Record<string, unknown> } | null;
  /** sensors (needs the "sensors" flag): `t` type, `p` the parameter it reads */
  sens?: Record<string, { n?: string; t?: string; p?: string }> | null;
  /** mileage counter, km (needs the "counters" flag) */
  cnm?: number;
};

export const DEFAULT_WIALON_HOST = "https://hst-api.wialon.com";

/** Wialon sessions per token, so companies never share one. */
const sessions = new Map<string, string>();

async function call<T>(host: string, svc: string, params: unknown, sid?: string): Promise<T> {
  const body = new URLSearchParams({ svc, params: JSON.stringify(params) });
  if (sid) body.set("sid", sid);
  const res = await fetch(`${host}/wialon/ajax.html`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Wialon HTTP ${res.status}`);
  const json = (await res.json()) as T & { error?: number; reason?: string };
  if (json && typeof json === "object" && "error" in json && json.error) {
    const err = new Error(`Wialon error ${json.error}${json.reason ? `: ${json.reason}` : ""}`) as Error & { code?: number };
    err.code = json.error;
    throw err;
  }
  return json;
}

async function login(host: string, token: string): Promise<string> {
  const res = await call<{ eid: string }>(host, "token/login", { token, fl: 1 });
  sessions.set(token, res.eid);
  return res.eid;
}

async function searchUnits(host: string, token: string, retry = true): Promise<WialonUnit[]> {
  const sid = sessions.get(token) ?? (await login(host, token));
  try {
    const res = await call<{ items: WialonUnit[] }>(
      host,
      "core/search_items",
      {
        spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
        force: 1,
        flags: 1 | 256 | 1024 | 4096 | 8192, // base info + hardware unique ID + last message/position + sensors + counters
        from: 0,
        to: 0,
      },
      sid,
    );
    return res.items ?? [];
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (retry && (code === 1 || code === 4 || code === 7)) {
      sessions.delete(token); // session expired → log in again once
      return searchUnits(host, token, false);
    }
    throw e;
  }
}

/**
 * Parameters trackers use for the truck's own odometer (CAN / tachograph / FMS), in the
 * order we trust them. Teltonika sends io_87 (CAN total mileage) and io_16 (total odometer).
 */
const ODO_PARAMS = [
  "can_mileage", "can_odometer", "can_total_mileage", "can_dist", "hr_total_vehicle_distance", "tacho_odometer",
  "io_87", "odometer", "total_mileage", "mileage", "io_16",
];

/** Raw odometer value → km. Trackers send km or metres; no truck has driven 3 million km, so a bigger number is metres. */
const toKm = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const km = n > 3_000_000 ? n / 1000 : n;
  return km >= 1 ? Math.round(km) : null;
};

/**
 * The truck's odometer as tracking knows it: first a mileage/odometer sensor set up on
 * the unit, then a known CAN parameter in the last message, then Wialon's own mileage
 * counter (which only matches the dashboard if someone set it up to).
 */
function mileage(u: WialonUnit): { km: number; src: "can" | "counter" } | null {
  const params = u.lmsg?.p ?? {};
  const sensorParams = Object.values(u.sens ?? {})
    .filter((x) => x?.p && /mileage|odometer|kilometra|odometar/i.test(`${x.t ?? ""} ${x.n ?? ""}`))
    .map((x) => x.p!.match(/[A-Za-z_][A-Za-z0-9_]*/)?.[0]) // a sensor may read an expression like "io_87/1000"
    .filter((k): k is string => !!k);
  for (const key of [...sensorParams, ...ODO_PARAMS]) {
    const km = toKm(params[key]);
    if (km) return { km, src: "can" };
  }
  if (typeof u.cnm === "number" && u.cnm > 0) return { km: Math.round(u.cnm), src: "counter" };
  return null;
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9ČĆŠŽĐ]/g, "");

/**
 * Units are cached per token for a short while and concurrent requests share one
 * Wialon call, so several people watching the same company's map cost one fetch.
 */
const UNIT_TTL_MS = 20_000;
const unitCache = new Map<string, { at: number; units: Promise<WialonUnit[]> }>();

function cachedUnits(host: string, token: string): Promise<WialonUnit[]> {
  const key = `${host}|${token}`;
  const hit = unitCache.get(key);
  if (hit && Date.now() - hit.at < UNIT_TTL_MS) return hit.units;
  const units = searchUnits(host, token);
  unitCache.set(key, { at: Date.now(), units });
  units.catch(() => unitCache.delete(key)); // never keep a failure
  if (unitCache.size > 500) unitCache.delete(unitCache.keys().next().value!);
  return units;
}

export async function wialonPositions(cfg: { token: string; host: string }, vehicles: TrackedVehicle[], now = Date.now()): Promise<Position[]> {
  const units = await cachedUnits(cfg.host.replace(/\/$/, ""), cfg.token);
  const byUnitId = new Map(vehicles.filter((v) => v.wialonUnitId).map((v) => [String(v.wialonUnitId).trim(), v]));
  const byPlate = vehicles.map((v) => ({ key: norm(v.plate), v })).filter((x) => x.key.length >= 4);

  return units.map((u) => {
    // The vehicle field accepts the Wialon unit ID or the device's unique ID (IMEI).
    const match = byUnitId.get(String(u.id)) ?? (u.uid ? byUnitId.get(u.uid.trim()) : undefined) ?? byPlate.find((x) => norm(u.nm).includes(x.key))?.v ?? null;
    const p = u.pos;
    const odo = mileage(u);
    if (!p) {
      return { unitId: String(u.id), uid: u.uid ?? null, unitName: u.nm, vehicleId: match?.id ?? null, lat: 0, lng: 0, speed: 0, course: 0, ts: 0, state: "offline", mileageKm: odo?.km ?? null, mileageSrc: odo?.src ?? null } satisfies Position;
    }
    const ts = p.t * 1000;
    const stale = now - ts > 60 * 60 * 1000;
    return {
      unitId: String(u.id),
      uid: u.uid ?? null,
      unitName: u.nm,
      vehicleId: match?.id ?? null,
      lat: p.y,
      lng: p.x,
      speed: p.s ?? 0,
      course: p.c ?? 0,
      ts,
      state: stale ? "offline" : (p.s ?? 0) > 3 ? "moving" : "stopped",
      mileageKm: odo?.km ?? null,
      mileageSrc: odo?.src ?? null,
    } satisfies Position;
  });
}

/**
 * Accepts only public https hosts for Wialon Local, so a company setting cannot make
 * the server call internal addresses. Returns the normalized origin or null.
 */
export function normalizeWialonHost(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  const privateHost =
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.startsWith("[") ||
    !h.includes(".");
  return privateHost ? null : u.origin;
}

export function wialonConfigured(cfg: WialonConfig): cfg is { token: string; host: string | null } {
  return !!cfg.token?.trim();
}
