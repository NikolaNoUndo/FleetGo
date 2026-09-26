import "server-only";
import { simulate } from "./simulator";
import { wialonPositions } from "./wialon";
import type { PositionsResult, TrackedVehicle } from "./types";

export type { Position, PositionsResult, TrackedVehicle } from "./types";

export function telematicsMode(): "wialon" | "simulation" {
  return process.env.WIALON_TOKEN ? "wialon" : "simulation";
}

/** Single entry point for live positions. Swap providers here (Wialon today, others later). */
export async function getPositions(vehicles: TrackedVehicle[]): Promise<PositionsResult> {
  const fetchedAt = Date.now();
  if (telematicsMode() === "wialon") {
    try {
      const positions = await wialonPositions(vehicles, fetchedAt);
      return { source: "wialon", positions, fetchedAt };
    } catch (e) {
      console.error("Wialon failed, falling back to simulation", e);
      return { source: "simulation", positions: simulate(vehicles, fetchedAt), error: (e as Error).message, fetchedAt };
    }
  }
  return { source: "simulation", positions: simulate(vehicles, fetchedAt), fetchedAt };
}
