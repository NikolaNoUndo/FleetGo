import "server-only";
import { DEFAULT_WIALON_HOST, wialonConfigured, wialonFuel, wialonPositions, type FuelLevel } from "./wialon";
import type { PositionsResult, TrackedVehicle, WialonConfig } from "./types";

export type { Position, PositionsResult, TrackedVehicle, WialonConfig } from "./types";
export { normalizeWialonHost } from "./wialon";
export type { FuelLevel } from "./wialon";

/** Single entry point for live positions of one company. No token → no positions (never fake data). */
export async function getPositions(cfg: WialonConfig, vehicles: TrackedVehicle[]): Promise<PositionsResult> {
  const fetchedAt = Date.now();
  if (!wialonConfigured(cfg)) return { source: "none", positions: [], fetchedAt };
  try {
    const positions = await wialonPositions({ token: cfg.token.trim(), host: cfg.host || DEFAULT_WIALON_HOST }, vehicles, fetchedAt);
    return { source: "wialon", positions, fetchedAt };
  } catch (e) {
    console.error("Wialon request failed", (e as Error).message);
    return { source: "error", positions: [], error: (e as Error).message, fetchedAt };
  }
}

/** Fuel in one unit's tank(s) from tracking; null when the unit reports none. */
export async function getFuelLevel(cfg: WialonConfig, unitId: string): Promise<FuelLevel> {
  if (!wialonConfigured(cfg)) return null;
  return wialonFuel({ token: cfg.token.trim(), host: cfg.host || DEFAULT_WIALON_HOST }, unitId);
}
