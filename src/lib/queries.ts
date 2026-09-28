import "server-only";
import { cache } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCompany } from "./tenant";
import type { Refs } from "./resources";
import type { MapPlace } from "./places";
import { daysUntil } from "./format";

const S = schema;

export const listVehicles = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.vehicles).where(eq(S.vehicles.companyId, id)).orderBy(asc(S.vehicles.plate));
});
export const listTrailers = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.trailers).where(eq(S.trailers.companyId, id)).orderBy(asc(S.trailers.plate));
});
export const listEmployees = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.employees).where(eq(S.employees.companyId, id)).orderBy(asc(S.employees.lastName), asc(S.employees.firstName));
});
export const listDocuments = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.documents).where(eq(S.documents.companyId, id)).orderBy(asc(S.documents.expiresAt));
});
export const listServices = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.services).where(eq(S.services.companyId, id)).orderBy(desc(S.services.date), desc(S.services.createdAt));
});
export const listParts = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.parts).where(eq(S.parts.companyId, id)).orderBy(desc(S.parts.date), desc(S.parts.createdAt));
});
export const listFuel = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.fuelEntries).where(eq(S.fuelEntries.companyId, id)).orderBy(desc(S.fuelEntries.date), desc(S.fuelEntries.createdAt));
});
export const listPayments = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.driverPayments).where(eq(S.driverPayments.companyId, id)).orderBy(desc(S.driverPayments.date), desc(S.driverPayments.createdAt));
});

/** vehicle ↔ trailer links of the company */
export const listVehicleTrailers = cache(async () => {
  const { id } = await getCompany();
  return db.select({ vehicleId: S.vehicleTrailers.vehicleId, trailerId: S.vehicleTrailers.trailerId }).from(S.vehicleTrailers).where(eq(S.vehicleTrailers.companyId, id));
});

export const listSuppliers = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(S.suppliers).where(eq(S.suppliers.companyId, id)).orderBy(asc(S.suppliers.name));
});

/** Shops and fuel stations for the live map, with their supplier's name and phone. */
export const listPlaces = cache(async (): Promise<MapPlace[]> => {
  const { id } = await getCompany();
  const P = S.places;
  const rows = await db
    .select({
      id: P.id,
      kind: P.kind,
      name: P.name,
      address: P.address,
      lat: P.lat,
      lng: P.lng,
      note: P.note,
      supplierId: P.supplierId,
      supplierName: S.suppliers.name,
      phone: S.suppliers.phone,
    })
    .from(P)
    .leftJoin(S.suppliers, eq(S.suppliers.id, P.supplierId))
    .where(eq(P.companyId, id))
    .orderBy(asc(P.name));
  return rows.map((r) => ({ ...r, kind: r.kind === "pump" ? "pump" : "shop" }));
});

export type Vehicle = Awaited<ReturnType<typeof listVehicles>>[number];
export type Trailer = Awaited<ReturnType<typeof listTrailers>>[number];
export type Employee = Awaited<ReturnType<typeof listEmployees>>[number];
export type Doc = Awaited<ReturnType<typeof listDocuments>>[number];
export type Service = Awaited<ReturnType<typeof listServices>>[number];
export type Part = Awaited<ReturnType<typeof listParts>>[number];
export type FuelEntry = Awaited<ReturnType<typeof listFuel>>[number];
export type Payment = Awaited<ReturnType<typeof listPayments>>[number];
export type Supplier = Awaited<ReturnType<typeof listSuppliers>>[number];

export const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

/** Options for every <select> that points at another record, plus id → label lookups for tables. */
export const getRefs = cache(async () => {
  const [vehicles, trailers, employees, suppliers] = await Promise.all([listVehicles(), listTrailers(), listEmployees(), listSuppliers()]);
  const refs: Refs = {
    vehicles: vehicles.map((v) => ({ id: v.id, label: v.plate, sub: [v.brand, v.model].filter(Boolean).join(" ") })),
    trailers: trailers.map((t) => ({ id: t.id, label: t.plate, sub: t.brand ?? undefined })),
    employees: employees.map((e) => ({ id: e.id, label: fullName(e) })),
    drivers: employees.filter((e) => e.role === "driver").map((e) => ({ id: e.id, label: fullName(e) })),
    suppliers: suppliers.map((x) => ({ id: x.id, label: x.name })),
  };
  const names: Record<string, string> = {};
  for (const v of vehicles) names[v.id] = v.plate;
  for (const t of trailers) names[t.id] = t.plate;
  for (const e of employees) names[e.id] = fullName(e);
  for (const x of suppliers) names[x.id] = x.name;
  return { refs, names };
});

export const getAlertCounts = cache(async () => {
  const [docs, company] = await Promise.all([listDocuments(), getCompany()]);
  let expired = 0;
  let soon = 0;
  for (const d of docs) {
    const n = daysUntil(d.expiresAt);
    if (n === null) continue;
    if (n < 0) expired++;
    else if (n <= company.warnDays) soon++;
  }
  return { expired, soon };
});

/** Documents with the name of the thing they belong to. */
export async function documentsWithOwner(filter?: { entityType: string; entityId: string }) {
  const [docs, { names }] = await Promise.all([listDocuments(), getRefs()]);
  return docs
    .filter((d) => !filter || (d.entityType === filter.entityType && d.entityId === filter.entityId))
    .map((d) => ({ ...d, ownerName: names[d.entityId] ?? "—" }));
}

export async function getVehicle(id: string) {
  const { id: companyId } = await getCompany();
  const [v] = await db.select().from(S.vehicles).where(and(eq(S.vehicles.id, id), eq(S.vehicles.companyId, companyId))).limit(1);
  return v ?? null;
}
export async function getTrailer(id: string) {
  const { id: companyId } = await getCompany();
  const [v] = await db.select().from(S.trailers).where(and(eq(S.trailers.id, id), eq(S.trailers.companyId, companyId))).limit(1);
  return v ?? null;
}
export async function getEmployee(id: string) {
  const { id: companyId } = await getCompany();
  const [v] = await db.select().from(S.employees).where(and(eq(S.employees.id, id), eq(S.employees.companyId, companyId))).limit(1);
  return v ?? null;
}

/**
 * Average consumption (l/100 km) per vehicle from consecutive full-tank refuels:
 * litres added at refuel N / km driven since refuel N-1.
 */
export function consumptionByVehicle(fuel: FuelEntry[]) {
  const byV = new Map<string, FuelEntry[]>();
  for (const f of fuel) {
    if (!f.vehicleId || !f.odometerKm) continue;
    const arr = byV.get(f.vehicleId) ?? [];
    arr.push(f);
    byV.set(f.vehicleId, arr);
  }
  const out: Record<string, { l100: number; km: number; liters: number }> = {};
  for (const [vid, arr] of byV) {
    const sorted = arr.sort((a, b) => a.odometerKm! - b.odometerKm!);
    let liters = 0;
    let km = 0;
    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i].odometerKm! - sorted[i - 1].odometerKm!;
      if (d <= 0 || d > 5000 || !sorted[i].fullTank) continue;
      km += d;
      liters += sorted[i].liters;
    }
    if (km > 0) out[vid] = { l100: (liters / km) * 100, km, liters };
  }
  return out;
}
