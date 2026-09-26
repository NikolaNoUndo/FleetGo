import type { Position, TrackedVehicle } from "./types";

/**
 * Wialon Remote API connector (Wialon Hosting or Wialon Local).
 * Docs: https://sdk.wialon.com/wiki/en/sidebar/remoteapi/apiref/apiref
 *
 * Env:
 *   WIALON_TOKEN  – access token created in Wialon (Account → Tokens / via OAuth page)
 *   WIALON_HOST   – optional, defaults to https://hst-api.wialon.com (use your own for Wialon Local)
 */

type WialonUnit = {
  id: number;
  nm: string;
  pos?: { t: number; y: number; x: number; s: number; c: number } | null;
};

const host = () => (process.env.WIALON_HOST || "https://hst-api.wialon.com").replace(/\/$/, "");

let session: { eid: string; at: number } | null = null;

async function call<T>(svc: string, params: unknown, sid?: string): Promise<T> {
  const body = new URLSearchParams({ svc, params: JSON.stringify(params) });
  if (sid) body.set("sid", sid);
  const res = await fetch(`${host()}/wialon/ajax.html`, {
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

async function login(): Promise<string> {
  const token = process.env.WIALON_TOKEN;
  if (!token) throw new Error("WIALON_TOKEN is not set");
  const res = await call<{ eid: string }>("token/login", { token, fl: 1 });
  session = { eid: res.eid, at: Date.now() };
  return res.eid;
}

async function searchUnits(retry = true): Promise<WialonUnit[]> {
  const sid = session?.eid ?? (await login());
  try {
    const res = await call<{ items: WialonUnit[] }>(
      "core/search_items",
      {
        spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
        force: 1,
        flags: 1 | 1024, // base info + last position
        from: 0,
        to: 0,
      },
      sid,
    );
    return res.items ?? [];
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (retry && (code === 1 || code === 4 || code === 7)) {
      session = null; // session expired → log in again once
      return searchUnits(false);
    }
    throw e;
  }
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9ČĆŠŽĐ]/g, "");

export async function wialonPositions(vehicles: TrackedVehicle[], now = Date.now()): Promise<Position[]> {
  const units = await searchUnits();
  const byUnitId = new Map(vehicles.filter((v) => v.wialonUnitId).map((v) => [String(v.wialonUnitId).trim(), v]));
  const byPlate = vehicles.map((v) => ({ key: norm(v.plate), v })).filter((x) => x.key.length >= 4);

  return units.map((u) => {
    const match = byUnitId.get(String(u.id)) ?? byPlate.find((x) => norm(u.nm).includes(x.key))?.v ?? null;
    const p = u.pos;
    if (!p) {
      return { unitId: String(u.id), unitName: u.nm, vehicleId: match?.id ?? null, lat: 0, lng: 0, speed: 0, course: 0, ts: 0, state: "offline" } satisfies Position;
    }
    const ts = p.t * 1000;
    const stale = now - ts > 60 * 60 * 1000;
    return {
      unitId: String(u.id),
      unitName: u.nm,
      vehicleId: match?.id ?? null,
      lat: p.y,
      lng: p.x,
      speed: p.s ?? 0,
      course: p.c ?? 0,
      ts,
      state: stale ? "offline" : (p.s ?? 0) > 3 ? "moving" : "stopped",
    } satisfies Position;
  });
}
