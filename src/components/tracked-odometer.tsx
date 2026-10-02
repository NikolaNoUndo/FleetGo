"use client";

import { useEffect, useState } from "react";
import { Satellite } from "lucide-react";
import { usePrefs } from "./prefs";
import { fmtNum, relTime } from "@/lib/format";
import type { PositionsResult } from "@/lib/telematics/types";

type State = { kind: "loading" } | { kind: "hidden" } | { kind: "error" } | { kind: "unlinked" } | { kind: "nodata" } | { kind: "ok"; km: number; ts: number; src: "can" | "counter" | null };

/**
 * "Kilometraža (praćenje)": the odometer Wialon keeps for this vehicle's unit, next to
 * the one typed in by hand. Hidden when the company has no tracking or the member
 * can't see the live map.
 */
export function TrackedOdometer({ vehicleId }: { vehicleId: string }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [s, setS] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let off = false;
    fetch("/api/positions", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return setS({ kind: "hidden" });
        const d = (await r.json()) as PositionsResult;
        if (off) return;
        if (d.source === "none") return setS({ kind: "hidden" });
        if (d.source === "error") return setS({ kind: "error" });
        const p = d.positions.find((x) => x.vehicleId === vehicleId);
        if (!p) return setS({ kind: "unlinked" });
        if (!p.mileageKm) return setS({ kind: "nodata" });
        setS({ kind: "ok", km: p.mileageKm, ts: p.ts, src: p.mileageSrc ?? null });
      })
      .catch(() => !off && setS({ kind: "error" }));
    return () => {
      off = true;
    };
  }, [vehicleId]);

  if (s.kind === "hidden") return null;
  const muted = (text: string) => <span className="font-normal text-ink-3">{text}</span>;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-ink-3">
        {sr ? "Kilometraža (praćenje)" : "Odometer (tracking)"}
        <Satellite size={12} className="text-ink-4" />
      </span>
      <span className="text-right font-medium text-ink tnum">
        {s.kind === "loading" && muted("…")}
        {s.kind === "error" && muted(sr ? "Wialon ne odgovara" : "Wialon not answering")}
        {s.kind === "unlinked" && (
          <>
            {muted(sr ? "Nije povezano sa Wialonom" : "Not linked to Wialon")}
            <span className="block text-xs font-normal text-ink-3">{sr ? "Upiši Wialon ID ili IMEI u vozilo" : "Add the Wialon ID or IMEI to the vehicle"}</span>
          </>
        )}
        {s.kind === "nodata" && (
          <>
            {muted(sr ? "Uređaj ne šalje kilometražu" : "The device sends no odometer")}
            <span className="block text-xs font-normal text-ink-3">{sr ? "Nema CAN kilometraže ni brojača u Wialonu" : "No CAN odometer or mileage counter in Wialon"}</span>
          </>
        )}
        {s.kind === "ok" && (
          <>
            {fmtNum(s.km, locale)} km
            <span className="block text-xs font-normal text-ink-3">
              {[s.src === "can" ? (sr ? "sa kamiona (CAN)" : "from the truck (CAN)") : s.src === "counter" ? (sr ? "Wialon brojač" : "Wialon counter") : null, s.ts > 0 ? relTime(s.ts, locale) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
