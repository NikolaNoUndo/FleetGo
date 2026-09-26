import type { L } from "../catalog";

/** Modules a membership can be granted access to. Safe to import on client and server. */
export const MODULES = [
  { key: "overview", label: { sr: "Pregled", en: "Overview" } },
  { key: "live", label: { sr: "Mapa uživo", en: "Live map" } },
  { key: "vehicles", label: { sr: "Vozila", en: "Vehicles" } },
  { key: "trailers", label: { sr: "Prikolice", en: "Trailers" } },
  { key: "employees", label: { sr: "Zaposleni", en: "Employees" } },
  { key: "documents", label: { sr: "Rokovi i dokumenta", en: "Expiries & documents" } },
  { key: "fuel", label: { sr: "Gorivo", en: "Fuel" } },
  { key: "services", label: { sr: "Servisi", en: "Services" } },
  { key: "parts", label: { sr: "Delovi i nabavka", en: "Parts & purchases" } },
  { key: "payments", label: { sr: "Uplate vozačima", en: "Driver payments" } },
  { key: "settings", label: { sr: "Podešavanja firme", en: "Company settings" } },
] as const satisfies readonly { key: string; label: L }[];

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Access = "none" | "view" | "edit";
export type Perms = Record<ModuleKey, Access>;

export type Role = "owner" | "dispatcher" | "service" | "accounting";

export const ROLES: { value: Role; label: L; hint: L }[] = [
  { value: "owner", label: { sr: "Vlasnik", en: "Owner" }, hint: { sr: "Sve, uključujući članove i podešavanja", en: "Everything, including members and settings" } },
  { value: "dispatcher", label: { sr: "Dispečer", en: "Dispatcher" }, hint: { sr: "Vozila, rokovi, gorivo", en: "Vehicles, expiries, fuel" } },
  { value: "service", label: { sr: "Servis", en: "Service" }, hint: { sr: "Servisi, delovi, rokovi", en: "Services, parts, expiries" } },
  { value: "accounting", label: { sr: "Knjigovodstvo", en: "Accounting" }, hint: { sr: "Troškovi i uplate", en: "Costs and payments" } },
];

const all = (a: Access): Perms => Object.fromEntries(MODULES.map((m) => [m.key, a])) as Perms;

export const ROLE_PRESETS: Record<Role, Perms> = {
  owner: all("edit"),
  dispatcher: {
    overview: "view",
    live: "view",
    vehicles: "edit",
    trailers: "edit",
    employees: "view",
    documents: "edit",
    fuel: "edit",
    services: "view",
    parts: "view",
    payments: "none",
    settings: "none",
  },
  service: {
    overview: "view",
    live: "view",
    vehicles: "view",
    trailers: "view",
    employees: "none",
    documents: "edit",
    fuel: "none",
    services: "edit",
    parts: "edit",
    payments: "none",
    settings: "none",
  },
  accounting: {
    overview: "view",
    live: "view",
    vehicles: "view",
    trailers: "view",
    employees: "view",
    documents: "none",
    fuel: "edit",
    services: "edit",
    parts: "edit",
    payments: "edit",
    settings: "none",
  },
};

export function isRole(x: unknown): x is Role {
  return typeof x === "string" && ROLES.some((r) => r.value === x);
}

/** The permissions that actually apply: owners always have everything. */
export function effectivePerms(role: string, stored: Partial<Record<string, Access>> | null | undefined): Perms {
  if (role === "owner") return all("edit");
  const base = isRole(role) ? ROLE_PRESETS[role] : all("none");
  const out = { ...base };
  if (stored) for (const m of MODULES) if (stored[m.key] === "none" || stored[m.key] === "view" || stored[m.key] === "edit") out[m.key] = stored[m.key]!;
  return out;
}

export function can(perms: Perms, module: ModuleKey, level: "view" | "edit" = "view"): boolean {
  const a = perms[module];
  return level === "view" ? a === "view" || a === "edit" : a === "edit";
}

/** Reports are open to anyone who can see at least one cost module. */
export function canReports(perms: Perms) {
  return (["fuel", "payments", "services", "parts"] as const).some((m) => can(perms, m));
}

/** Suppliers are shared by parts and services. */
export function canSuppliers(perms: Perms, level: "view" | "edit" = "view") {
  return can(perms, "parts", level) || can(perms, "services", level);
}

/** Which module guards each editable resource. */
export const RESOURCE_MODULE = {
  vehicles: "vehicles",
  trailers: "trailers",
  employees: "employees",
  documents: "documents",
  services: "services",
  parts: "parts",
  fuel: "fuel",
  payments: "payments",
} as const satisfies Record<string, ModuleKey>;

/** Sidebar route → module. */
export const ROUTE_MODULE: Record<string, ModuleKey | "suppliers" | "reports"> = {
  "/": "overview",
  "/live": "live",
  "/vehicles": "vehicles",
  "/trailers": "trailers",
  "/employees": "employees",
  "/documents": "documents",
  "/fuel": "fuel",
  "/services": "services",
  "/parts": "parts",
  "/suppliers": "suppliers",
  "/payments": "payments",
  "/settings": "settings",
  "/reports": "reports",
};
