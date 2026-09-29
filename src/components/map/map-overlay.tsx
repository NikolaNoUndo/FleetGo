"use client";

import Link from "@/components/ui/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Building2, Check, ChevronDown, Fuel, Minus, Search, SquareParking, Store, Truck, Wrench, X } from "lucide-react";
import { usePrefs } from "../prefs";
import { cn } from "../ui/primitives";
import { PLACE_COLORS } from "./place-colors";
import type { MapPlace, PlaceKind } from "@/lib/places";
import type { MapPoint } from "./fleet-map";
import { groupState, setAll, subGroups, toggleGroup, toggleSub, type GroupKey, type Layers } from "./layers";

const KIND_ICON: Record<PlaceKind, typeof Fuel> = { pump: Fuel, shop: Store, service: Wrench, hq: Building2, parking: SquareParking };

export function KindDot({ kind, size = 18 }: { kind: PlaceKind; size?: number }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full text-white" style={{ width: size, height: size, background: PLACE_COLORS[kind] }}>
      <Icon size={Math.round(size * 0.58)} strokeWidth={2} />
    </span>
  );
}

function Check3({ state, color }: { state: "checked" | "mixed" | "off"; color: string }) {
  const on = state !== "off";
  return (
    <span
      className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", on ? "border-transparent text-white" : "border-line-strong bg-surface")}
      style={on ? { background: color } : undefined}
    >
      {state === "checked" && <Check size={11} strokeWidth={3} />}
      {state === "mixed" && <Minus size={11} strokeWidth={3} />}
    </span>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && closeRef.current();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}

type Hit =
  { type: "place"; place: MapPlace } | { type: "unit"; point: MapPoint };
const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");

function MapSearch({
  places,
  points,
  onPick,
}: {
  places: MapPlace[];
  points: MapPoint[];
  onPick: (h: Hit) => void;
}) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useDismiss(open, () => setOpen(false));

  const hits: Hit[] = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const match = (text: string) => {
      const t = fold(text);
      return words.every((w) => t.includes(w));
    };
    const units: Hit[] = points
      .filter((p) => match(`${p.label} ${p.unitName ?? ""}`))
      .slice(0, 4)
      .map((point) => ({ type: "unit", point }));
    const pl: Hit[] = places
      .filter((p) =>
        match(`${p.name} ${p.supplierName ?? ""} ${p.address ?? ""}`),
      )
      .slice(0, 8 - units.length)
      .map((place) => ({ type: "place", place }));
    return [...units, ...pl];
  }, [q, places, points]);

  const pick = (h: Hit) => {
    onPick(h);
    setOpen(false);
    setQ(h.type === "place" ? h.place.name : h.point.label);
  };

  return (
    <div ref={ref} className="relative w-full sm:w-60">
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 text-ink-3"
      />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => q && setOpen(true)}
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(hits[Math.min(active, hits.length - 1)]);
          }
        }}
        placeholder={
          sr ? "Traži lokaciju ili vozilo…" : "Find a place or vehicle…"
        }
        aria-label={sr ? "Traži na mapi" : "Search the map"}
        className="h-8 w-full rounded-lg border border-line bg-surface/95 pr-7 pl-8 text-[13px] text-ink shadow-xs backdrop-blur outline-none placeholder:text-ink-4 focus:border-accent-line"
      />
      {q && (
        <button
          type="button"
          aria-label={sr ? "Obriši" : "Clear"}
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
          className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-3 hover:text-ink"
        >
          <X size={13} />
        </button>
      )}
      {open && q.trim() && (
        <ul className="animate-pop absolute top-full right-0 left-0 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop">
          {hits.length === 0 && (
            <li className="px-2 py-2 text-sm text-ink-3">
              {sr ? "Nema rezultata" : "No results"}
            </li>
          )}
          {hits.map((h, i) => (
            <li key={h.type === "place" ? h.place.id : h.point.unitId}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                  i === active && "bg-surface-2",
                )}
              >
                {h.type === "place" ? (
                  <KindDot kind={h.place.kind} />
                ) : (
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-ink text-white">
                    <Truck size={10} strokeWidth={2} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {h.type === "place" ? h.place.name : h.point.label}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {h.type === "place"
                      ? (h.place.address ?? h.place.supplierName ?? "")
                      : (h.point.place ?? (sr ? "Vozilo" : "Vehicle"))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Toggles ---------- */

/* ---------- Layer switches: click the name for all, the arrow to pick ---------- */

const GROUP_META: Record<GroupKey, { icon: typeof Fuel; color: string; sr: string; en: string }> = {
  pumps: { icon: Fuel, color: PLACE_COLORS.pump, sr: "Pumpe", en: "Fuel" },
  shops: { icon: Store, color: PLACE_COLORS.shop, sr: "Delovi i servisi", en: "Parts & workshops" },
  company: { icon: Building2, color: PLACE_COLORS.hq, sr: "Firma", en: "Company" },
};

function GroupSwitch({
  group,
  places,
  layers,
  setLayers,
  open,
  setOpen,
}: {
  group: GroupKey;
  places: MapPlace[];
  layers: Layers;
  setLayers: (l: Layers) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const { locale, can } = usePrefs();
  const sr = locale === "sr";
  const meta = GROUP_META[group];
  const Icon = meta.icon;
  const subs = useMemo(() => subGroups(places, group, locale), [places, group, locale]);
  const total = subs.reduce((n, s) => n + s.count, 0);
  const state = groupState(layers, group, subs);
  const g = layers[group];
  const onSub = (key: string) => g.on && (g.sel === null || g.sel.includes(key));
  const ref = useDismiss(open, () => setOpen(false));
  const disabled = total === 0;

  return (
    <div ref={ref} className="relative">
      <div className={cn("inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-line bg-surface/95 text-[13px] font-medium text-ink shadow-xs backdrop-blur", disabled && "opacity-60")}>
        <button
          type="button"
          role="checkbox"
          aria-checked={state === "mixed" ? "mixed" : state === "checked"}
          disabled={disabled}
          onClick={() => setLayers(toggleGroup(layers, group))}
          title={disabled ? (sr ? "Još nema unetih lokacija" : "No places added yet") : sr ? "Prikaži / sakrij sve" : "Show / hide all"}
          className="inline-flex items-center gap-2 pr-2 pl-2.5 transition-colors enabled:hover:bg-surface-2 disabled:cursor-not-allowed"
        >
          <Check3 state={state} color={meta.color} />
          <Icon size={14} className="hidden sm:block" style={{ color: meta.color }} />
          {sr ? meta.sr : meta.en}
          <span className="text-xs text-ink-3 tnum">{state === "mixed" ? `${subs.filter((s) => onSub(s.key)).length}/${subs.length}` : total}</span>
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={sr ? `Izaberi: ${meta.sr}` : `Choose: ${meta.en}`}
          onClick={() => setOpen(!open)}
          className="grid w-7 place-items-center border-l border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div role="dialog" className="animate-pop absolute top-full right-0 z-10 mt-1.5 w-72 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop">
          {subs.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-2 pt-1 pb-1.5 text-xs text-ink-3">
                <span>{sr ? "Prikaži na mapi" : "Show on map"}</span>
                <span className="flex gap-2">
                  <button type="button" className="font-medium text-accent hover:underline" onClick={() => setLayers(setAll(layers, group, true))}>
                    {sr ? "Sve" : "All"}
                  </button>
                  <button type="button" className="font-medium text-accent hover:underline" onClick={() => setLayers(setAll(layers, group, false))}>
                    {sr ? "Nijedna" : "None"}
                  </button>
                </span>
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {subs.map((sub) => (
                  <li key={sub.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={onSub(sub.key)}
                      onClick={() => setLayers(toggleSub(layers, group, sub.key, subs))}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      <Check3 state={onSub(sub.key) ? "checked" : "off"} color={meta.color} />
                      <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                      <span className="flex gap-0.5">
                        {sub.kinds.map((k) => (
                          <KindDot key={k} kind={k} size={16} />
                        ))}
                      </span>
                      <span className="w-6 text-right text-xs text-ink-3 tnum">{sub.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-2 py-2 text-sm text-ink-3">{sr ? "Još nema unetih lokacija ove vrste." : "No places of this kind yet."}</p>
          )}
          <div className="mt-1 border-t border-line px-2 pt-2 pb-1">
            <Link href="/live/places" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              {can("suppliers", "edit") ? (sr ? "Dodaj ili izmeni lokacije" : "Add or edit places") : sr ? "Sve lokacije" : "All places"} <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function MapOverlay({
  places,
  points,
  layers,
  setLayers,
  onPick,
}: {
  places: MapPlace[];
  points: MapPoint[];
  layers: Layers;
  setLayers: (l: Layers) => void;
  onPick: (h: Hit) => void;
}) {
  const [open, setOpen] = useState<GroupKey | null>(null);
  return (
    <div className="absolute top-3 right-3 left-14 z-[500] flex flex-wrap items-start justify-end gap-1.5">
      <MapSearch places={places} points={points} onPick={onPick} />
      {(["pumps", "shops", "company"] as const).map((g) => (
        <GroupSwitch key={g} group={g} places={places} layers={layers} setLayers={setLayers} open={open === g} setOpen={(o) => setOpen(o ? g : null)} />
      ))}
    </div>
  );
}

export type { Hit as MapHit };
