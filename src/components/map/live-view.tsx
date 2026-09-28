"use client";

import dynamic from "next/dynamic";
import Link from "@/components/ui/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, ChevronDown, Fuel, Info, Navigation, RefreshCw, Store } from "lucide-react";
import { usePrefs } from "../prefs";
import { Badge, cn } from "../ui/primitives";
import { SearchInput, Segmented } from "../ui/client";
import type { PositionsResult } from "@/lib/telematics/types";
import type { MapPoint } from "./fleet-map";
import { relTime } from "@/lib/format";
import type { MapPlace } from "@/lib/places";
import { PLACE_COLORS } from "./place-colors";

const FleetMap = dynamic(() => import("./fleet-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type Api = PositionsResult & { vehicles: { id: string; plate: string; driverName: string | null }[] };

/** Stop refreshing after this long without mouse, keyboard or touch activity. */
const IDLE_MS = 10 * 60_000;

/**
 * Polls live positions. Every request costs server time, so it only polls while
 * the tab is visible and someone is actually at the screen, and not at all when
 * the company has no Wialon token. Wialon positions rarely change faster than
 * every 30–60 s, so shorter intervals would only add cost.
 */
export function useLivePositions(intervalMs = 30_000) {
  const [data, setData] = useState<Api | null>(null);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let alive = true;
    let lastActive = Date.now();
    let idle = false;
    let noSource = false;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await fetch("/api/positions", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Api;
        noSource = j.source === "none";
        if (alive) {
          setData(j);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        busy = false;
      }
    };
    const tick = () => {
      if (document.hidden || noSource) return;
      if (Date.now() - lastActive > IDLE_MS) {
        if (!idle) {
          idle = true;
          setPaused(true);
        }
        return;
      }
      load();
    };
    const onActivity = () => {
      lastActive = Date.now();
      if (idle) {
        idle = false;
        setPaused(false);
        load();
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    load();
    const id = setInterval(tick, intervalMs);
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      for (const e of events) window.removeEventListener(e, onActivity);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  const points: MapPoint[] = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.vehicles.map((v) => [v.id, v]));
    return data.positions.map((p) => ({ ...p, label: p.vehicleId ? (byId.get(p.vehicleId)?.plate ?? p.unitName) : p.unitName }));
  }, [data]);
  return { data, points, error, paused };
}

const DOT = { moving: "bg-good", stopped: "bg-info", offline: "bg-ink-4" } as const;

/* ---------- Shops / fuel stations toggles (top right of the map) ---------- */

type Layers = { pumps: boolean; shops: string[] };
const LAYERS_KEY = "rl_map_layers";
const NO_SUPPLIER = "_none";

function parseLayers(raw: string | null): Layers {
  try {
    const j = JSON.parse(raw ?? "null");
    if (j && typeof j.pumps === "boolean" && Array.isArray(j.shops)) return { pumps: j.pumps, shops: j.shops.map(String) };
  } catch {
    /* bad value */
  }
  return { pumps: false, shops: [] };
}

// The choice lives in this browser only (per viewer), read through an external store
// so the server render and first paint show nothing switched on.
const layerListeners = new Set<() => void>();
let memoryLayers: string | null = null;
const layerStore = {
  subscribe(fn: () => void) {
    layerListeners.add(fn);
    return () => layerListeners.delete(fn);
  },
  get(): string | null {
    try {
      return localStorage.getItem(LAYERS_KEY);
    } catch {
      return memoryLayers;
    }
  },
  set(l: Layers) {
    const raw = JSON.stringify(l);
    memoryLayers = raw;
    try {
      localStorage.setItem(LAYERS_KEY, raw);
    } catch {
      /* private mode: keep it in memory */
    }
    layerListeners.forEach((fn) => fn());
  },
};

function Check2({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", on ? "border-transparent text-white" : "border-line-strong bg-surface")}
      style={on ? { background: color } : undefined}
    >
      {on && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function PlacesControl({ places, layers, setLayers }: { places: MapPlace[]; layers: Layers; setLayers: (l: Layers) => void }) {
  const { locale, can } = usePrefs();
  const L = (sr: string, en: string) => (locale === "sr" ? sr : en);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pumps = places.filter((p) => p.kind === "pump").length;
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; count: number }>();
    for (const p of places) {
      if (p.kind !== "shop") continue;
      const key = p.supplierId ?? NO_SUPPLIER;
      const g = m.get(key) ?? { key, label: p.supplierName ?? L("Bez dobavljača", "No supplier"), count: 0 };
      g.count++;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => (a.key === NO_SUPPLIER ? 1 : b.key === NO_SUPPLIER ? -1 : a.label.localeCompare(b.label)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, locale]);
  const on = new Set(layers.shops.filter((k) => groups.some((g) => g.key === k)));
  const toggleShop = (k: string) => setLayers({ ...layers, shops: on.has(k) ? [...on].filter((x) => x !== k) : [...on, k] });
  const chip =
    "inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface/95 px-2.5 text-[13px] font-medium text-ink shadow-xs backdrop-blur transition-colors hover:bg-surface-2";

  return (
    <div className="absolute top-3 right-3 z-[500] flex items-start gap-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={layers.pumps}
        disabled={!pumps}
        onClick={() => setLayers({ ...layers, pumps: !layers.pumps })}
        className={cn(chip, !pumps && "cursor-not-allowed opacity-60 hover:bg-surface/95")}
        title={pumps ? undefined : L("Još nema unetih pumpi", "No fuel stations added yet")}
      >
        <Check2 on={layers.pumps && pumps > 0} color={PLACE_COLORS.pump} />
        <Fuel size={14} style={{ color: PLACE_COLORS.pump }} />
        {L("Pumpe", "Fuel")}
        <span className="text-xs text-ink-3 tnum">{pumps}</span>
      </button>

      <div ref={ref} className="relative">
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={chip}>
          <Check2 on={on.size > 0} color={PLACE_COLORS.shop} />
          <Store size={14} style={{ color: PLACE_COLORS.shop }} />
          {L("Prodavnice", "Shops")}
          <span className="text-xs text-ink-3 tnum">{on.size ? `${on.size}/${groups.length}` : groups.length}</span>
          <ChevronDown size={14} className={cn("text-ink-3 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div role="dialog" className="animate-pop absolute top-full right-0 mt-1.5 w-64 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop">
            {groups.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-2 pt-1 pb-1.5 text-xs text-ink-3">
                  <span>{L("Prikaži na mapi", "Show on map")}</span>
                  <span className="flex gap-2">
                    <button type="button" className="font-medium text-accent hover:underline" onClick={() => setLayers({ ...layers, shops: groups.map((g) => g.key) })}>
                      {L("Sve", "All")}
                    </button>
                    <button type="button" className="font-medium text-accent hover:underline" onClick={() => setLayers({ ...layers, shops: [] })}>
                      {L("Nijedna", "None")}
                    </button>
                  </span>
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {groups.map((g) => (
                    <li key={g.key}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on.has(g.key)}
                        onClick={() => toggleShop(g.key)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                      >
                        <Check2 on={on.has(g.key)} color={PLACE_COLORS.shop} />
                        <span className="min-w-0 flex-1 truncate">{g.label}</span>
                        <span className="text-xs text-ink-3 tnum">{g.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="px-2 py-2 text-sm text-ink-3">{L("Još nema unetih prodavnica.", "No shops added yet.")}</p>
            )}
            <div className="mt-1 border-t border-line px-2 pt-2 pb-1">
              <Link href="/live/places" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                {can("suppliers", "edit") ? L("Dodaj ili izmeni lokacije", "Add or edit places") : L("Sve lokacije", "All places")} <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function usePlaceLayers(places: MapPlace[]) {
  const raw = useSyncExternalStore(layerStore.subscribe, layerStore.get, () => null);
  const layers = useMemo(() => parseLayers(raw), [raw]);
  const shown = useMemo(() => {
    const shops = new Set(layers.shops);
    return places.filter((p) => (p.kind === "pump" ? layers.pumps : shops.has(p.supplierId ?? NO_SUPPLIER)));
  }, [places, layers]);
  return { layers, setLayers: layerStore.set, shown };
}

export function LiveView({ places = [] }: { places?: MapPlace[] }) {
  const { t, locale, can } = usePrefs();
  const { layers, setLayers, shown } = usePlaceLayers(places);
  const { data, points, error, paused } = useLivePositions();
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
            {paused ? (locale === "sr" ? "Pauzirano dok ne pomeriš miš" : "Paused until you move the mouse") : data ? `${t("l.updated")} ${relTime(data.fetchedAt, locale)}` : "…"}
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
        <div className="relative isolate h-[52vh] overflow-hidden rounded-xl border border-line bg-surface shadow-xs lg:h-[calc(100dvh-236px)] lg:flex-1">
          <FleetMap points={points} selected={selected} onSelect={setSelected} places={shown} />
          <PlacesControl places={places} layers={layers} setLayers={setLayers} />
        </div>
      </div>
    </div>
  );
}

export function LiveMini() {
  const { t } = usePrefs();
  const { data, points } = useLivePositions(60_000);
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
