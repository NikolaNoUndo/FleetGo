"use client";

import Link from "@/components/ui/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Fuel,
  Search,
  Store,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { usePrefs } from "../prefs";
import { cn } from "../ui/primitives";
import { PLACE_COLORS } from "./place-colors";
import type { MapPlace, PlaceKind } from "@/lib/places";
import type { MapPoint } from "./fleet-map";

export type Layers = { pumps: boolean; shops: string[] };
export const NO_SUPPLIER = "_none";

const KIND_ICON: Record<PlaceKind, typeof Fuel> = {
  pump: Fuel,
  shop: Store,
  service: Wrench,
};

export function KindDot({
  kind,
  size = 18,
}: {
  kind: PlaceKind;
  size?: number;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: PLACE_COLORS[kind] }}
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2} />
    </span>
  );
}

function Check2({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        on ? "border-transparent text-white" : "border-line-strong bg-surface",
      )}
      style={on ? { background: color } : undefined}
    >
      {on && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const chip =
  "inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface/95 px-2.5 text-[13px] font-medium text-ink shadow-xs backdrop-blur transition-colors hover:bg-surface-2";

/* ---------- Search: places (all of them, switched on or not) and trucks ---------- */

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
  const { locale, can } = usePrefs();
  const L = (sr: string, en: string) => (locale === "sr" ? sr : en);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const pumps = places.filter((p) => p.kind === "pump").length;
  // parts shops and workshops, grouped by supplier (e.g. every Rapidex store)
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { key: string; label: string; count: number; kinds: Set<PlaceKind> }
    >();
    for (const p of places) {
      if (p.kind === "pump") continue;
      const key = p.supplierId ?? NO_SUPPLIER;
      const g = m.get(key) ?? {
        key,
        label: p.supplierName ?? L("Bez dobavljača", "No supplier"),
        count: 0,
        kinds: new Set<PlaceKind>(),
      };
      g.count++;
      g.kinds.add(p.kind);
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) =>
      a.key === NO_SUPPLIER
        ? 1
        : b.key === NO_SUPPLIER
          ? -1
          : a.label.localeCompare(b.label),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, locale]);
  const on = new Set(
    layers.shops.filter((k) => groups.some((g) => g.key === k)),
  );
  const toggleShop = (k: string) =>
    setLayers({
      ...layers,
      shops: on.has(k) ? [...on].filter((x) => x !== k) : [...on, k],
    });

  return (
    <div className="absolute top-3 right-3 left-14 z-[500] flex flex-wrap items-start justify-end gap-1.5">
      <MapSearch places={places} points={points} onPick={onPick} />

      <button
        type="button"
        role="checkbox"
        aria-checked={layers.pumps}
        disabled={!pumps}
        onClick={() => setLayers({ ...layers, pumps: !layers.pumps })}
        className={cn(
          chip,
          !pumps && "cursor-not-allowed opacity-60 hover:bg-surface/95",
        )}
        title={
          pumps
            ? undefined
            : L("Još nema unetih pumpi", "No fuel stations added yet")
        }
      >
        <Check2 on={layers.pumps && pumps > 0} color={PLACE_COLORS.pump} />
        <Fuel size={14} className="hidden sm:block" style={{ color: PLACE_COLORS.pump }} />
        {L("Pumpe", "Fuel")}
        <span className="text-xs text-ink-3 tnum">{pumps}</span>
      </button>

      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={chip}
        >
          <Check2 on={on.size > 0} color={PLACE_COLORS.shop} />
          <Store size={14} className="hidden sm:block" style={{ color: PLACE_COLORS.shop }} />
          {L("Delovi i servisi", "Parts & workshops")}
          <span className="text-xs text-ink-3 tnum">
            {on.size ? `${on.size}/${groups.length}` : groups.length}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "text-ink-3 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div
            role="dialog"
            className="animate-pop absolute top-full right-0 mt-1.5 w-72 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop"
          >
            {groups.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-2 pt-1 pb-1.5 text-xs text-ink-3">
                  <span>{L("Prikaži na mapi", "Show on map")}</span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="font-medium text-accent hover:underline"
                      onClick={() =>
                        setLayers({
                          ...layers,
                          shops: groups.map((g) => g.key),
                        })
                      }
                    >
                      {L("Sve", "All")}
                    </button>
                    <button
                      type="button"
                      className="font-medium text-accent hover:underline"
                      onClick={() => setLayers({ ...layers, shops: [] })}
                    >
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
                        <span className="min-w-0 flex-1 truncate">
                          {g.label}
                        </span>
                        <span className="flex gap-0.5">
                          {[...g.kinds].map((k) => (
                            <KindDot key={k} kind={k} size={16} />
                          ))}
                        </span>
                        <span className="w-5 text-right text-xs text-ink-3 tnum">
                          {g.count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="px-2 py-2 text-sm text-ink-3">
                {L(
                  "Još nema unetih prodavnica ni servisa.",
                  "No shops or workshops added yet.",
                )}
              </p>
            )}
            <div className="mt-1 border-t border-line px-2 pt-2 pb-1">
              <Link
                href="/live/places"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                {can("suppliers", "edit")
                  ? L("Dodaj ili izmeni lokacije", "Add or edit places")
                  : L("Sve lokacije", "All places")}{" "}
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { Hit as MapHit };
