"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Position } from "@/lib/telematics/types";
import type { MapPlace } from "@/lib/places";
import { PLACE_COLORS } from "./place-colors";

export type MapPoint = Position & { label: string };

/**
 * Map tiles. CARTO basemaps now require an API key, so the default is the standard
 * OpenStreetMap layer. Another provider (MapTiler, Stadia…) can be set with
 * NEXT_PUBLIC_MAP_TILE_URL and NEXT_PUBLIC_MAP_ATTRIBUTION.
 */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const COLORS = { moving: "#16a34a", stopped: "#3b82f6", offline: "#9ca3af" } as const;

function icon(p: MapPoint, selected: boolean) {
  const c = COLORS[p.state];
  const arrow =
    p.state === "moving"
      ? `<svg width="12" height="12" viewBox="0 0 24 24" style="transform:rotate(${Math.round(p.course)}deg)"><path d="M12 3l7 18-7-4-7 4z" fill="${c}"/></svg>`
      : `<span style="width:8px;height:8px;border-radius:99px;background:${c};display:inline-block"></span>`;
  const html = `<div style="display:inline-flex;align-items:center;gap:6px;transform:translate(-50%,-50%);white-space:nowrap;
    background:${selected ? "#111" : "#fff"};color:${selected ? "#fff" : "#111"};border:1px solid ${selected ? "#111" : "#e2e2e2"};
    box-shadow:0 2px 8px rgba(0,0,0,.12);border-radius:9px;padding:3px 8px 3px 6px;font:600 12px/1.2 var(--font-sans);letter-spacing:-.01em">
    ${arrow}<span>${p.label.replace(/</g, "&lt;")}</span></div>`;
  return L.divIcon({ html, className: "fg-marker", iconSize: [0, 0] });
}

/* ---------- Shops and fuel stations ---------- */


// lucide "fuel" and "store", inlined so the marker HTML needs no React render
const PLACE_GLYPH = {
  pump: '<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/>',
  shop: '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
} as const;

const placeIcons = new Map<string, L.DivIcon>();
function placeIcon(kind: MapPlace["kind"]) {
  let i = placeIcons.get(kind);
  if (!i) {
    const html = `<div class="rl-place" style="width:24px;height:24px;border-radius:99px;background:${PLACE_COLORS[kind]};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PLACE_GLYPH[kind]}</svg></div>`;
    i = L.divIcon({ html, className: "fg-marker", iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
    placeIcons.set(kind, i);
  }
  return i;
}

/** Only markers inside the visible area are drawn, so thousands of stations stay fast. */
const MAX_PLACE_MARKERS = 1500;

function PlacesLayer({ places, fit }: { places: MapPlace[]; fit: boolean }) {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds());
  useMapEvents({ moveend: () => setBounds(map.getBounds()) });

  // with no vehicles on the map, frame the places the first time some are switched on
  const has = places.length > 0;
  useEffect(() => {
    if (!fit || !has) return;
    const b = L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]));
    if (!map.getBounds().intersects(b) || places.length < 50) map.fitBounds(b.pad(0.15), { animate: false, maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, has, map]);

  const visible = useMemo(() => {
    const b = bounds.pad(0.25);
    return places.filter((p) => b.contains([p.lat, p.lng])).slice(0, MAX_PLACE_MARKERS);
  }, [places, bounds]);

  return (
    <>
      {visible.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={placeIcon(p.kind)} zIndexOffset={-500}>
          <Tooltip direction="top" offset={[0, -12]} opacity={1}>
            {p.name}
          </Tooltip>
          <Popup>
            <div className="min-w-[180px] font-sans text-[13px] leading-snug text-ink">
              <div className="font-semibold">{p.name}</div>
              {p.supplierName && p.supplierName !== p.name && <div className="text-ink-3">{p.supplierName}</div>}
              {p.address && <div className="mt-1">{p.address}</div>}
              {p.phone && (
                <a className="mt-1 block" style={{ color: "var(--accent)" }} href={`tel:${p.phone.replace(/\s/g, "")}`}>
                  {p.phone}
                </a>
              )}
              {p.note && <div className="mt-1 text-ink-3">{p.note}</div>}
              <a
                className="mt-2 inline-block font-medium"
                style={{ color: "var(--accent)" }}
                href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Google Maps ↗
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function Fit({ points, selected }: { points: MapPoint[]; selected: string | null }) {
  const map = useMap();
  const hasPoints = points.length > 0;
  // fit once when points first arrive
  useEffect(() => {
    if (!hasPoints) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b.pad(0.15), { animate: false, maxZoom: 9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPoints, map]);
  useEffect(() => {
    if (!selected) return;
    const p = points.find((x) => x.unitId === selected);
    if (p) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 9), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, map]);
  return null;
}

export default function FleetMap({
  points,
  selected,
  onSelect,
  interactive = true,
  places,
}: {
  points: MapPoint[];
  selected: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  places?: MapPlace[];
}) {
  const valid = useMemo(() => points.filter((p) => p.lat || p.lng), [points]);
  return (
    <MapContainer
      center={[44.8, 20.46]}
      zoom={6}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      attributionControl
      className="h-full w-full"
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={19} className="rl-map-tiles" />
      <Fit points={valid} selected={selected} />
      {places && <PlacesLayer places={places} fit={valid.length === 0} />}
      {valid.map((p) => (
        <Marker
          key={p.unitId}
          position={[p.lat, p.lng]}
          icon={icon(p, p.unitId === selected)}
          zIndexOffset={p.unitId === selected ? 1000 : p.state === "moving" ? 100 : 0}
          eventHandlers={{ click: () => onSelect?.(p.unitId) }}
        >
          {p.place && (
            <Tooltip direction="top" offset={[0, -14]} opacity={1}>
              {p.place}
              {p.state === "moving" ? ` · ${Math.round(p.speed)} km/h` : ""}
            </Tooltip>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
