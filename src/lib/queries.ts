import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCompany } from "./tenant";
import type { Refs } from "./resources";
import { asPlaceKind, type MapPlace } from "./places";
import { daysUntil, todayISO } from "./format";
import { addMonthsDate } from "./expenses";
import { DOC_TYPES, type EntityType } from "./catalog";

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

/**
 * Creates this month's (and any missed months') copies of monthly costs. Runs before
 * expenses are read; the template rows are locked so two requests can't both add a copy.
 */
async function syncRecurringExpenses(companyId: string) {
  const E = S.expenses;
  const today = todayISO();
  await db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(E)
      .where(and(eq(E.companyId, companyId), eq(E.recurring, true), lte(E.recurringNext, today)))
      .for("update");
    for (const t of due) {
      const anchor = Number(t.date.slice(8, 10));
      const copies: (typeof E.$inferInsert)[] = [];
      let next = t.recurringNext!;
      // months between the template and `next`, so the day stays the template's (31st → last day)
      const step = (d: string) => {
        const [y1, m1] = t.date.split("-").map(Number);
        const [y2, m2] = d.split("-").map(Number);
        return addMonthsDate(t.date, (y2 - y1) * 12 + (m2 - m1) + 1, anchor);
      };
      while (next <= today && (!t.recurringUntil || next <= t.recurringUntil) && copies.length < 36) {
        copies.push({
          companyId,
          date: next,
          category: t.category,
          description: t.description,
          supplierId: t.supplierId,
          vehicleId: t.vehicleId,
          trailerId: t.trailerId,
          amount: t.amount,
          currency: t.currency,
          paid: t.paid,
          parentId: t.id,
        });
        next = step(next);
      }
      if (copies.length) await tx.insert(E).values(copies);
      const ended = t.recurringUntil && next > t.recurringUntil;
      await tx.update(E).set({ recurringNext: ended ? null : next }).where(eq(E.id, t.id));
    }
  });
}

export const listExpenses = cache(async () => {
  const { id } = await getCompany();
  await syncRecurringExpenses(id);
  return db.select().from(S.expenses).where(eq(S.expenses.companyId, id)).orderBy(desc(S.expenses.date), desc(S.expenses.createdAt));
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
      phone: sql<string | null>`coalesce(${P.phone}, ${S.suppliers.phone})`,
      ownPhone: P.phone,
      dieselPrice: P.dieselPrice,
      priceCurrency: P.priceCurrency,
      priceUpdatedAt: P.priceUpdatedAt,
    })
    .from(P)
    .leftJoin(S.suppliers, eq(S.suppliers.id, P.supplierId))
    .where(eq(P.companyId, id))
    .orderBy(asc(P.name));
  return rows.map((r) => ({ ...r, kind: asPlaceKind(r.kind), priceUpdatedAt: r.priceUpdatedAt ? r.priceUpdatedAt.toISOString() : null }));
});

export type Vehicle = Awaited<ReturnType<typeof listVehicles>>[number];
export type Trailer = Awaited<ReturnType<typeof listTrailers>>[number];
export type Employee = Awaited<ReturnType<typeof listEmployees>>[number];
export type Doc = Awaited<ReturnType<typeof listDocuments>>[number];
export type Service = Awaited<ReturnType<typeof listServices>>[number];
export type Expense = Awaited<ReturnType<typeof listExpenses>>[number];
export type Part = Awaited<ReturnType<typeof listParts>>[number];
export type FuelEntry = Awaited<ReturnType<typeof listFuel>>[number];
export type Payment = Awaited<ReturnType<typeof listPayments>>[number];
export type Supplier = Awaited<ReturnType<typeof listSuppliers>>[number];

export const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

/** Options for every <select> that points at another record, plus id → label lookups for tables. */
export const getRefs = cache(async () => {
  const { id: companyId } = await getCompany();
  const [vehicles, trailers, employees, suppliers, docs, clients] = await Promise.all([
    listVehicles(),
    listTrailers(),
    listEmployees(),
    listSuppliers(),
    listDocuments(),
    db.select({ id: S.clients.id, name: S.clients.name }).from(S.clients).where(eq(S.clients.companyId, companyId)).orderBy(asc(S.clients.name)),
  ]);
  // kinds of documents the company typed in itself ("Drugo"): id = the name, sub = what it is for
  const ownDocTypes = new Map<string, { id: string; label: string; sub: string }>();
  for (const d of docs) {
    const builtIn = DOC_TYPES[d.entityType as EntityType]?.some((o) => o.value === d.docType);
    if (!builtIn) ownDocTypes.set(`${d.entityType}|${d.docType}`, { id: d.docType, label: d.docType, sub: d.entityType });
  }
  const refs: Refs = {
    docTypes: [...ownDocTypes.values()],
    vehicles: vehicles.map((v) => ({ id: v.id, label: v.plate, sub: [v.brand, v.model].filter(Boolean).join(" ") })),
    trailers: trailers.map((t) => ({ id: t.id, label: t.plate, sub: t.brand ?? undefined })),
    reefers: trailers.filter((t) => t.type === "reefer").map((t) => ({ id: t.id, label: t.plate, sub: t.brand ?? undefined })),
    employees: employees.map((e) => ({ id: e.id, label: fullName(e) })),
    drivers: employees.filter((e) => e.role === "driver").map((e) => ({ id: e.id, label: fullName(e) })),
    suppliers: suppliers.map((x) => ({ id: x.id, label: x.name })),
    clients: clients.map((x) => ({ id: x.id, label: x.name })),
  };
  const names: Record<string, string> = {};
  for (const v of vehicles) names[v.id] = v.plate;
  for (const t of trailers) names[t.id] = t.plate;
  for (const e of employees) names[e.id] = fullName(e);
  for (const x of suppliers) names[x.id] = x.name;
  for (const x of clients) names[x.id] = x.name;
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
