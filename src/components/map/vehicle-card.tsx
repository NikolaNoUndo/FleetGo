"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/link";
import { ArrowUpRight, Check, Copy, Fuel, Gauge, MapPin, User, X } from "lucide-react";
import { usePrefs } from "../prefs";
import { cn } from "../ui/primitives";
import { fmtNum, relTime } from "@/lib/format";
import { copyText } from "./copy-coords";
import type { MapPoint } from "./fleet-map";

type FuelData = { value: number; unit: string; tanks: number } | null;
type FuelState = { unit: string; kind: "loading" } | { unit: string; kind: "none" } | { unit: string; kind: "error" } | { unit: string; kind: "ok"; fuel: NonNullable<FuelData> };

const DOT = { moving: "bg-good", stopped: "bg-info", offline: "bg-ink-4" } as const;

/**
 * The truck picked on the live map (clicked on the map or in the list): driver,
 * odometer, coordinates to copy and the fuel in the tank, all from tracking.
 */
export function VehicleCard({ p, driver, onClose }: { p: MapPoint; driver: string | null; onClose: () => void }) {
  const { t, locale } = usePrefs();
  const sr = locale === "sr";
  const [fuel, setFuel] = useState<FuelState>({ unit: p.unitId, kind: "loading" });
  const [copied, setCopied] = useState(false);

  // fuel is asked for when a truck is opened (and again if it stays open as positions refresh)
  useEffect(() => {
    let off = false;
    const load = () =>
      fetch(`/api/positions/fuel?unit=${encodeURIComponent(p.unitId)}`, { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const j = (await r.json()) as { fuel: FuelData };
          if (!off) setFuel(j.fuel ? { unit: p.unitId, kind: "ok", fuel: j.fuel } : { unit: p.unitId, kind: "none" });
        })
        .catch(() => !off && setFuel({ unit: p.unitId, kind: "error" }));
    load();
    const i = setInterval(load, 60_000);
    return () => {
      off = true;
      clearInterval(i);
    };
  }, [p.unitId]);
  const f: FuelState = fuel.unit === p.unitId ? fuel : { unit: p.unitId, kind: "loading" };

  const hasPos = !!(p.lat || p.lng);
  const coords = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
  const copy = async () => {
    if (await copyText(coords)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const row = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex min-h-9 items-center gap-2.5 border-t border-line py-1.5">
      <span className="text-ink-4">{icon}</span>
      <span className="w-24 shrink-0 text-xs text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-right text-sm font-medium text-ink tnum">{value}</span>
    </div>
  );
  const muted = (s: string) => <span className="font-normal text-ink-3">{s}</span>;

  return (
    <div className="animate-pop absolute right-3 bottom-3 left-3 z-[600] rounded-xl border border-line bg-surface p-3.5 pb-2 text-ink shadow-pop sm:right-auto sm:w-[320px]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{p.label}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
            <span className={cn("size-1.5 rounded-full", DOT[p.state])} />
            {p.state === "moving" ? `${Math.round(p.speed)} km/h` : t(p.state === "stopped" ? "l.stopped" : "l.offline")}
            {p.ts > 0 && <span>· {relTime(p.ts, locale)}</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={sr ? "Zatvori" : "Close"} className="focus-ring -mt-1 -mr-1.5 grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <X size={16} />
        </button>
      </div>

      <div className="mt-2.5">
        {row(<User size={14} />, sr ? "Vozač" : "Driver", driver || muted("—"))}
        {row(<Gauge size={14} />, sr ? "Kilometraža" : "Odometer", p.mileageKm ? `${fmtNum(p.mileageKm, locale)} km` : muted(sr ? "nema podatka" : "no data"))}
        {row(
          <Fuel size={14} />,
          sr ? "Gorivo" : "Fuel",
          f.kind === "loading"
            ? muted("…")
            : f.kind === "error"
              ? muted(sr ? "Wialon ne odgovara" : "Wialon not answering")
              : f.kind === "none"
                ? muted(sr ? "nema senzora" : "no sensor")
                : `${fmtNum(f.fuel.value, locale)} ${f.fuel.unit}${f.fuel.tanks > 1 ? (sr ? ` (${f.fuel.tanks} rezervoara)` : ` (${f.fuel.tanks} tanks)`) : ""}`,
        )}
        {row(
          <MapPin size={14} />,
          sr ? "Koordinate" : "Coordinates",
          hasPos ? (
            <button
              type="button"
              onClick={copy}
              title={sr ? "Kopiraj koordinate" : "Copy coordinates"}
              className="group -mr-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-surface-2"
            >
              {copied ? <span className="text-good-ink">{sr ? "Kopirano" : "Copied"}</span> : `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
              {copied ? <Check size={13} className="text-good" /> : <Copy size={13} className="text-ink-4 group-hover:text-ink-2" />}
            </button>
          ) : (
            muted("—")
          ),
        )}
      </div>

      {p.vehicleId && (
        <div className="border-t border-line pt-2">
          <Link href={`/vehicles/${p.vehicleId}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            {sr ? "Otvori vozilo" : "Open vehicle"} <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
