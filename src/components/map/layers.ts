import type { MapPlace, PlaceKind } from "@/lib/places";

/**
 * Which places the live map shows. Three groups, each with a main switch and an
 * optional sub-selection: fuel stations by network, parts shops / workshops by
 * supplier (e.g. every Rapidex store), and our own places (head office, parking).
 * `sel: null` means "all of the group"; switching the group off keeps `sel`, so
 * switching it on again brings back the same choice.
 */
export type GroupKey = "pumps" | "shops" | "company";
export type GroupState = { on: boolean; sel: string[] | null };
export type Layers = Record<GroupKey, GroupState>;

export const GROUPS: GroupKey[] = ["pumps", "shops", "company"];
export const NO_SUPPLIER = "_none";
export const EMPTY_LAYERS: Layers = { pumps: { on: false, sel: null }, shops: { on: false, sel: null }, company: { on: false, sel: null } };

export const groupOf = (p: Pick<MapPlace, "kind">): GroupKey => (p.kind === "pump" ? "pumps" : p.kind === "hq" || p.kind === "parking" ? "company" : "shops");

/** Sub-group within a group: the supplier / network, or the kind for our own places. */
export const subKeyOf = (p: Pick<MapPlace, "kind" | "supplierId">): string => (groupOf(p) === "company" ? p.kind : (p.supplierId ?? NO_SUPPLIER));

export function isShown(p: MapPlace, layers: Layers): boolean {
  const g = layers[groupOf(p)];
  return g.on && (g.sel === null || g.sel.includes(subKeyOf(p)));
}

export type SubGroup = { key: string; label: string; count: number; kinds: PlaceKind[] };

export function subGroups(places: MapPlace[], group: GroupKey, locale: "sr" | "en"): SubGroup[] {
  const sr = locale === "sr";
  const KIND_LABEL: Partial<Record<PlaceKind, string>> = { hq: sr ? "Sedište" : "Head office", parking: sr ? "Parking / plac" : "Parking / yard" };
  const m = new Map<string, SubGroup>();
  for (const p of places) {
    if (groupOf(p) !== group) continue;
    const key = subKeyOf(p);
    const label =
      group === "company" ? (KIND_LABEL[p.kind] ?? p.kind) : (p.supplierName ?? (group === "pumps" ? (sr ? "Bez mreže" : "No network") : sr ? "Bez dobavljača" : "No supplier"));
    const g = m.get(key) ?? { key, label, count: 0, kinds: [] };
    g.count++;
    if (!g.kinds.includes(p.kind)) g.kinds.push(p.kind);
    m.set(key, g);
  }
  const order = (k: string) => (k === "hq" ? 0 : k === "parking" ? 1 : k === NO_SUPPLIER ? 3 : 2);
  return [...m.values()].sort((a, b) => order(a.key) - order(b.key) || a.label.localeCompare(b.label));
}

/** "checked", "mixed" (only some sub-groups) or "off" for a group's main checkbox. */
export function groupState(layers: Layers, group: GroupKey, subs: SubGroup[]): "checked" | "mixed" | "off" {
  const g = layers[group];
  if (!g.on) return "off";
  if (g.sel === null) return "checked";
  const on = subs.filter((s) => g.sel!.includes(s.key)).length;
  return on === 0 ? "off" : on === subs.length ? "checked" : "mixed";
}

export function toggleGroup(layers: Layers, group: GroupKey): Layers {
  const g = layers[group];
  // back on: the previous choice returns (all, if nothing was chosen)
  const next: GroupState = g.on ? { ...g, on: false } : { on: true, sel: g.sel && g.sel.length ? g.sel : null };
  return { ...layers, [group]: next };
}

export function toggleSub(layers: Layers, group: GroupKey, key: string, subs: SubGroup[]): Layers {
  const g = layers[group];
  const all = subs.map((s) => s.key);
  const current = g.on ? (g.sel ?? all) : [];
  const nextSel = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  const next: GroupState = nextSel.length === 0 ? { on: false, sel: null } : { on: true, sel: all.every((k) => nextSel.includes(k)) ? null : nextSel };
  return { ...layers, [group]: next };
}

export const setAll = (layers: Layers, group: GroupKey, on: boolean): Layers => ({ ...layers, [group]: { on, sel: null } });

export function parseLayers(raw: string | null): Layers {
  try {
    const j = JSON.parse(raw ?? "null");
    if (!j || typeof j !== "object") return EMPTY_LAYERS;
    const out = { ...EMPTY_LAYERS };
    for (const k of GROUPS) {
      const g = j[k];
      if (g && typeof g.on === "boolean") out[k] = { on: g.on, sel: Array.isArray(g.sel) ? g.sel.map(String) : null };
    }
    return out;
  } catch {
    return EMPTY_LAYERS;
  }
}
