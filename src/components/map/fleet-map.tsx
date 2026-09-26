"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Position } from "@/lib/telematics/types";

export type MapPoint = Position & { label: string };

const COLORS = { moving: "#16a34a", stopped: "#e19a06", offline: "#9ca3af" } as const;

function icon(p: MapPoint, selected: boolean) {
  const c = COLORS[p.state];
  const arrow =
    p.state === "moving"
      ? `<svg width="12" height="12" viewBox="0 0 24 24" style="transform:rotate(${Math.round(p.course)}deg)"><path d="M12 3l7 18-7-4-7 4z" fill="${c}"/></svg>`
      : `<span style="width:8px;height:8px;border-radius:99px;background:${c};display:inline-block"></span>`;
  const html = `<div style="display:inline-flex;align-items:center;gap:6px;transform:translate(-50%,-50%);white-space:nowrap;
    background:${selected ? "#111" : "#fff"};color:${selected ? "#fff" : "#111"};border:1px solid ${selected ? "#111" : "#e2e2e2"};
    box-shadow:0 2px 8px rgba(0,0,0,.12);border-radius:9px;padding:3px 8px 3px 6px;font:600 11.5px/1.2 var(--font-sans);letter-spacing:-.01em">
    ${arrow}<span>${p.label.replace(/</g, "&lt;")}</span></div>`;
  return L.divIcon({ html, className: "fg-marker", iconSize: [0, 0] });
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
}: {
  points: MapPoint[];
  selected: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <Fit points={valid} selected={selected} />
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
