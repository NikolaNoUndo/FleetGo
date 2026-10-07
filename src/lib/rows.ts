import "server-only";
import { getRefs, listDocuments, listEmployees, listPayments, listTrailers, listVehicleTrailers, listVehicles, fullName, type Doc } from "./queries";
import { hasDriverCard, hasTachograph, nextReading, type ReadingKind } from "./catalog";
import type { EmployeeRow, TrailerRow, VehicleRow } from "@/components/tables/assets";

/** Earliest expiry per owner, used for the "next expiry" column. */
export function nextDocs(docs: Doc[]) {
  const map = new Map<string, { docType: string; expiresAt: string | null }>();
  for (const d of docs) {
    if (!d.expiresAt) continue;
    const cur = map.get(d.entityId);
    if (!cur || (cur.expiresAt ?? "9999") > d.expiresAt) map.set(d.entityId, { docType: d.docType, expiresAt: d.expiresAt });
  }
  return map;
}

type Next = { docType: string; expiresAt: string | null } | null;
/** the data download counts as "next" when it is due before any document */
function withReading(doc: Next | undefined, kind: ReadingKind, last: string | null, applies: boolean): Next {
  const due = applies ? nextReading(last, kind) : null;
  if (due && (!doc?.expiresAt || due < doc.expiresAt)) return { docType: kind, expiresAt: due };
  return doc ?? null;
}

export async function vehicleRows(): Promise<VehicleRow[]> {
  const [vehicles, trailers, employees, docs, links] = await Promise.all([listVehicles(), listTrailers(), listEmployees(), listDocuments(), listVehicleTrailers()]);
  const plateOf = new Map(trailers.map((t) => [t.id, t.plate]));
  const next = nextDocs(docs);
  const emp = new Map(employees.map((e) => [e.id, fullName(e)]));
  return vehicles.map((v) => ({
    id: v.id, plate: v.plate, type: v.type, brand: v.brand, model: v.model, year: v.year, vin: v.vin, euroNorm: v.euroNorm,
    odometerKm: v.odometerKm, status: v.status, driverId: v.driverId, wialonUnitId: v.wialonUnitId, notes: v.notes,
    extraDriverIds: v.extraDriverIds.filter((id) => emp.has(id)),
    driverName: v.driverId ? (emp.get(v.driverId) ?? null) : null,
    extraDriverNames: v.extraDriverIds.map((id) => emp.get(id)).filter((x): x is string => !!x),
    trailerIds: links.filter((l) => l.vehicleId === v.id).map((l) => l.trailerId),
    trailerPlates: links.filter((l) => l.vehicleId === v.id).map((l) => plateOf.get(l.trailerId) ?? "").filter(Boolean).sort(),
    nextDoc: withReading(next.get(v.id), "tacho_download", v.tachoReadAt, hasTachograph(v)),
  }));
}

export async function trailerRows(): Promise<TrailerRow[]> {
  const [trailers, docs, { names }, links] = await Promise.all([listTrailers(), listDocuments(), getRefs(), listVehicleTrailers()]);
  const next = nextDocs(docs);
  return trailers.map((t) => ({
    id: t.id, plate: t.plate, type: t.type, brand: t.brand, year: t.year, vin: t.vin, axles: t.axles, capacityKg: t.capacityKg,
    status: t.status, notes: t.notes,
    vehicleIds: links.filter((l) => l.trailerId === t.id).map((l) => l.vehicleId),
    vehiclePlates: links.filter((l) => l.trailerId === t.id).map((l) => names[l.vehicleId] ?? "").filter(Boolean).sort(),
    nextDoc: next.get(t.id) ?? null,
  }));
}

export async function employeeRows(): Promise<EmployeeRow[]> {
  const [employees, vehicles, docs, payments] = await Promise.all([listEmployees(), listVehicles(), listDocuments(), listPayments()]);
  const next = nextDocs(docs);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return employees.map((e) => ({
    id: e.id, firstName: e.firstName, lastName: e.lastName, role: e.role, phone: e.phone, email: e.email, hiredAt: e.hiredAt,
    status: e.status, notes: e.notes,
    vehiclePlate: vehicles.find((v) => v.driverId === e.id)?.plate ?? vehicles.find((v) => v.extraDriverIds.includes(e.id))?.plate ?? null,
    paidThisMonth: payments.filter((p) => p.employeeId === e.id && p.date >= monthStart).map((p) => ({ amount: p.amount, currency: p.currency })),
    nextDoc: withReading(next.get(e.id), "card_download", e.cardReadAt, hasDriverCard(e)),
  }));
}
