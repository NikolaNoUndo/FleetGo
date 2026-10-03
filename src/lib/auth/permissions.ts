import type { L } from "../catalog";

/** Modules a membership can be granted access to. Safe to import on client and server. */
export const MODULES = [
  { key: "overview", label: { sr: "Pregled", en: "Overview" } },
  { key: "live", label: { sr: "Mapa uživo", en: "Live map" } },
  { key: "tours", label: { sr: "Ture i klijenti", en: "Tours & clients" } },
  { key: "tourPrice", label: { sr: "Cena ture", en: "Tour price" }, hint: { sr: "Dogovorena cena na turi i prihod po klijentu", en: "The agreed price of a tour and revenue per client" } },
  { key: "profit", label: { sr: "Isplativost", en: "Profitability" }, hint: { sr: "Zarada po turi, klijentu i kamionu", en: "Profit per tour, client and truck" }, levels: ["none", "view"] },
  { key: "vehicles", label: { sr: "Vozila", en: "Vehicles" } },
  { key: "trailers", label: { sr: "Prikolice", en: "Trailers" } },
  { key: "employees", label: { sr: "Zaposleni", en: "Employees" } },
  { key: "documents", label: { sr: "Rokovi i dokumenta", en: "Expiries & documents" } },
  { key: "fuel", label: { sr: "Gorivo", en: "Fuel" } },
  { key: "services", label: { sr: "Servisi", en: "Services" } },
  { key: "parts", label: { sr: "Delovi i nabavka", en: "Parts & purchases" } },
  { key: "payments", label: { sr: "Uplate vozačima", en: "Driver payments" } },
  { key: "expenses", label: { sr: "Ostali troškovi", en: "Other costs" } },
  { key: "settings", label: { sr: "Podešavanja firme", en: "Company settings" } },
] as const satisfies readonly { key: string; label: L; hint?: L; levels?: readonly ("none" | "view" | "edit")[] }[];

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Access = "none" | "view" | "edit";
export type Perms = Record<ModuleKey, Access>;

export type Role = "owner" | "dispatcher" | "service" | "accounting";

export const ROLES: { value: Role; label: L; hint: L }[] = [
  { value: "owner", label: { sr: "Vlasnik", en: "Owner" }, hint: { sr: "Sve, uključujući članove i podešavanja", en: "Everything, including members and settings" } },
  { value: "dispatcher", label: { sr: "Dispečer", en: "Dispatcher" }, hint: { sr: "Ture i cene, vozila, rokovi, gorivo", en: "Tours and prices, vehicles, expiries, fuel" } },
  { value: "service", label: { sr: "Servis", en: "Service" }, hint: { sr: "Servisi, delovi, rokovi", en: "Services, parts, expiries" } },
  { value: "accounting", label: { sr: "Knjigovodstvo", en: "Accounting" }, hint: { sr: "Troškovi i uplate", en: "Costs and payments" } },
];

const all = (a: Access): Perms => Object.fromEntries(MODULES.map((m) => [m.key, a])) as Perms;

export const ROLE_PRESETS: Record<Role, Perms> = {
  owner: all("edit"),
  dispatcher: {
    overview: "view",
    live: "view",
    tours: "edit",
    tourPrice: "edit",
    profit: "none",
    vehicles: "edit",
    trailers: "edit",
    employees: "view",
    documents: "edit",
    fuel: "edit",
    services: "view",
    parts: "view",
    payments: "none",
    expenses: "none",
    settings: "none",
  },
  service: {
    overview: "view",
    live: "view",
    tours: "none",
    tourPrice: "none",
    profit: "none",
    vehicles: "view",
    trailers: "view",
    employees: "none",
    documents: "edit",
    fuel: "none",
    services: "edit",
    parts: "edit",
    payments: "none",
    expenses: "none",
    settings: "none",
  },
  accounting: {
    overview: "view",
    live: "view",
    tours: "view",
    tourPrice: "none",
    profit: "none",
    vehicles: "view",
    trailers: "view",
    employees: "view",
    documents: "none",
    fuel: "edit",
    services: "edit",
    parts: "edit",
    payments: "edit",
    expenses: "edit",
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
  return (["fuel", "payments", "services", "parts", "expenses"] as const).some((m) => can(perms, m));
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
  expenses: "expenses",
  tours: "tours",
  tourLegs: "tours",
  clients: "tours",
} as const satisfies Record<string, ModuleKey>;

/** Sidebar route → module. */
export const ROUTE_MODULE: Record<string, ModuleKey | "suppliers" | "reports"> = {
  "/": "overview",
  "/live": "live",
  "/tours": "tours",
  "/clients": "tours",
  "/vehicles": "vehicles",
  "/trailers": "trailers",
  "/employees": "employees",
  "/documents": "documents",
  "/fuel": "fuel",
  "/services": "services",
  "/parts": "parts",
  "/suppliers": "suppliers",
  "/payments": "payments",
  "/expenses": "expenses",
  "/settings": "settings",
  "/reports": "reports",
};
