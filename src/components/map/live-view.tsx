"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Info, Navigation, RefreshCw } from "lucide-react";
import { usePrefs } from "../prefs";
import { Badge, cn } from "../ui/primitives";
import { SearchInput, Segmented } from "../ui/client";
import type { PositionsResult } from "@/lib/telematics/types";
import type { MapPoint } from "./fleet-map";
import { relTime } from "@/lib/format";

const FleetMap = dynamic(() => import("./fleet-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type Api = PositionsResult & { vehicles: { id: string; plate: string; driverName: string | null }[] };

export function useLivePositions(intervalMs = 10000) {
  const [data, setData] = useState<Api | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/positions", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Api;
        if (alive) {
          setData(j);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  const points: MapPoint[] = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.vehicles.map((v) => [v.id, v]));
    return data.positions.map((p) => ({ ...p, label: p.vehicleId ? (byId.get(p.vehicleId)?.plate ?? p.unitName) : p.unitName }));
  }, [data]);
  return { data, points, error };
}

const DOT = { moving: "bg-good", stopped: "bg-info", offline: "bg-ink-4" } as const;

export function LiveView() {
  const { t, locale, can } = usePrefs();
  const { data, points, error } = useLivePositions();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "moving" | "stopped" | "offline">("all");
  const [q, setQ] = useState("");
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(i);
  }, []);

  const drivers = useMemo(() => new Map(data?.vehicles.map((v) => [v.id, v.driverName]) ?? []), [data]);
  const count = (s: string) => points.filter((p) => p.state === s).length;
  const list = points
    .filter((p) => filter === "all" || p.state === filter)
    .filter((p) => !q || `${p.label} ${drivers.get(p.vehicleId ?? "") ?? ""} ${p.place ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="order-2 flex min-h-0 flex-col rounded-xl border border-line bg-surface shadow-xs lg:order-1 lg:h-[calc(100dvh-236px)]">
        <div className="space-y-3 border-b border-line p-3">
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "all", label: t("c.all"), count: points.length },
              { value: "moving", label: t("l.moving"), count: count("moving") },
              { value: "stopped", label: t("l.stopped"), count: count("stopped") },
              { value: "offline", label: t("l.offline"), count: count("offline") },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder={t("c.search")} />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {!data && !error && [0, 1, 2, 3].map((i) => <li key={i} className="m-1 h-16 animate-pulse rounded-xl bg-surface-2" />)}
          {data && list.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-3">{t("l.noVehicles")}</li>}
          {list.map((p) => {
            const active = selected === p.unitId;
            return (
              <li key={p.unitId}>
                <button
                  type="button"
                  onClick={() => setSelected(p.unitId)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    active ? "border-line bg-surface-2" : "border-transparent hover:bg-surface-2/70",
                  )}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[p.state])} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{p.label}</span>
                      <span className="shrink-0 text-xs text-ink-2 tnum">
                        {p.state === "moving" ? `${Math.round(p.speed)} km/h` : t(p.state === "stopped" ? "l.stopped" : "l.offline")}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-3">
                      {(p.vehicleId && drivers.get(p.vehicleId)) || (p.vehicleId ? "—" : t("l.unassigned"))}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-3">
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <Navigation size={11} className="shrink-0" />
                        <span className="truncate">{p.place ?? `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`}</span>
                      </span>
                      {p.ts > 0 && <span className="shrink-0 tnum">{relTime(p.ts, locale)}</span>}
                    </span>
                  </span>
                </button>
                {active && p.vehicleId && (
                  <Link href={`/vehicles/${p.vehicleId}`} className="mx-3 mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                    {t("c.open")} <ArrowUpRight />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={12} />
            {data ? `${t("l.updated")} ${relTime(data.fetchedAt, locale)}` : "…"}
          </span>
          {data && <Badge tone={data.source === "wialon" ? "good" : data.source === "error" ? "bad" : "neutral"}>{t(data.source === "wialon" ? "l.source.wialon" : data.source === "error" ? "l.source.error" : "l.source.none")}</Badge>}
        </div>
      </div>

      <div className="order-1 flex flex-col gap-3 lg:order-2">
        {data && data.source !== "wialon" && (
          <div
            className={
              data.source === "error"
                ? "flex items-start gap-2.5 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-2.5 text-sm text-bad-ink"
                : "flex items-start gap-2.5 rounded-lg border border-accent-line bg-accent-soft px-3.5 py-2.5 text-sm text-accent-ink"
            }
          >
            <Info className="mt-px shrink-0" />
            <span>
              {t(data.source === "error" ? "l.errorHint" : "l.noneHint")}
              {data.error ? ` (${data.error})` : ""}
              {can("settings") && (
                <>
                  {" "}
                  <Link href="/settings" className="font-medium underline underline-offset-2">
                    {t("nav.settings")}
                  </Link>
                </>
              )}
            </span>
          </div>
        )}
        <div className="isolate h-[52vh] overflow-hidden rounded-xl border border-line bg-surface shadow-xs lg:h-[calc(100dvh-236px)] lg:flex-1">
          <FleetMap points={points} selected={selected} onSelect={setSelected} />
        </div>
      </div>
    </div>
  );
}

export function LiveMini() {
  const { t } = usePrefs();
  const { data, points } = useLivePositions(15000);
  const moving = points.filter((p) => p.state === "moving").length;
  const connected = data?.source === "wialon";
  return (
    <div className="relative isolate h-full min-h-[280px] overflow-hidden rounded-lg">
      <FleetMap points={points} selected={null} interactive={false} />
      {data && (
        <div className="pointer-events-none absolute top-3 left-3 z-[500] inline-flex items-center gap-2 rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-xs font-medium shadow-xs">
          {connected ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-good" />
              </span>
              {t("d.liveNow")} · {moving} {t("d.onRoad")}
            </>
          ) : (
            <>
              <span className={data.source === "error" ? "size-2 rounded-full bg-bad" : "size-2 rounded-full bg-ink-4"} />
              {t(data.source === "error" ? "l.source.error" : "l.source.none")}
            </>
          )}
        </div>
      )}
    </div>
  );
}
