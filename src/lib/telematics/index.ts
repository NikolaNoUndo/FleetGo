import "server-only";
import { DEFAULT_WIALON_HOST, wialonConfigured, wialonPositions } from "./wialon";
import type { PositionsResult, TrackedVehicle, WialonConfig } from "./types";

export type { Position, PositionsResult, TrackedVehicle, WialonConfig } from "./types";
export { normalizeWialonHost } from "./wialon";

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
