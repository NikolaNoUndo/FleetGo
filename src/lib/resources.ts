import type { OptionSetKey } from "./catalog";
import type { TKey } from "./i18n";

export type ResourceKey = "vehicles" | "trailers" | "employees" | "documents" | "services" | "parts" | "fuel" | "payments" | "suppliers";
export type RefKey = "vehicles" | "trailers" | "employees" | "drivers" | "suppliers";

export type FieldType = "text" | "int" | "decimal" | "money" | "date" | "select" | "ref" | "textarea" | "bool" | "entity" | "docType" | "supplier";

export type FieldDef = {
  name: string;
  label: TKey;
  type: FieldType;
  required?: boolean;
  options?: OptionSetKey;
  ref?: RefKey;
  span?: 1 | 2;
  placeholder?: string;
  defaultValue?: string | number | boolean;
};

export type RefOption = { id: string; label: string; sub?: string };
export type Refs = Partial<Record<RefKey, RefOption[]>>;

export const RESOURCES: Record<ResourceKey, { title: TKey; fields: FieldDef[] }> = {
  vehicles: {
    title: "r.vehicles",
    fields: [
      { name: "plate", label: "f.plate", type: "text", required: true, placeholder: "BG 1234-AB" },
      { name: "type", label: "f.type", type: "select", options: "vehicleTypes", required: true, defaultValue: "tractor" },
      { name: "brand", label: "f.brand", type: "text", placeholder: "Scania" },
      { name: "model", label: "f.model", type: "text", placeholder: "R450" },
      { name: "year", label: "f.year", type: "int" },
      { name: "euroNorm", label: "f.euroNorm", type: "select", options: "euroNorms" },
      { name: "vin", label: "f.vin", type: "text", span: 2 },
      { name: "odometerKm", label: "f.odometerKm", type: "int" },
      { name: "status", label: "f.status", type: "select", options: "assetStatus", required: true, defaultValue: "active" },
      { name: "driverId", label: "f.driver", type: "ref", ref: "drivers" },
      { name: "wialonUnitId", label: "f.wialonUnitId", type: "text" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  trailers: {
    title: "r.trailers",
    fields: [
      { name: "plate", label: "f.plate", type: "text", required: true, placeholder: "BG 123-AB" },
      { name: "type", label: "f.type", type: "select", options: "trailerTypes", required: true, defaultValue: "tarpaulin" },
      { name: "brand", label: "f.brand", type: "text", placeholder: "Schmitz Cargobull" },
      { name: "year", label: "f.year", type: "int" },
      { name: "vin", label: "f.vin", type: "text", span: 2 },
      { name: "axles", label: "f.axles", type: "int" },
      { name: "capacityKg", label: "f.capacityKg", type: "int" },
      { name: "status", label: "f.status", type: "select", options: "assetStatus", required: true, defaultValue: "active" },
      { name: "vehicleId", label: "x.coupledTo", type: "ref", ref: "vehicles" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  employees: {
    title: "r.employees",
    fields: [
      { name: "firstName", label: "f.firstName", type: "text", required: true },
      { name: "lastName", label: "f.lastName", type: "text", required: true },
      { name: "role", label: "f.role", type: "select", options: "employeeRoles", required: true, defaultValue: "driver" },
      { name: "status", label: "f.status", type: "select", options: "employeeStatus", required: true, defaultValue: "active" },
      { name: "phone", label: "f.phone", type: "text", placeholder: "+381 6x xxx xxxx" },
      { name: "email", label: "f.email", type: "text" },
      { name: "hiredAt", label: "f.hiredAt", type: "date" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  documents: {
    title: "r.documents",
    fields: [
      { name: "entityType", label: "f.entityType", type: "select", options: "entityTypes", required: true, defaultValue: "vehicle" },
      { name: "entityId", label: "f.entity", type: "entity", required: true },
      { name: "docType", label: "f.docType", type: "docType", required: true, span: 2 },
      { name: "number", label: "f.number", type: "text" },
      { name: "issuedAt", label: "f.issuedAt", type: "date" },
      { name: "expiresAt", label: "f.expiresAt", type: "date", required: true },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "RSD" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  services: {
    title: "r.services",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "kind", label: "f.kind", type: "select", options: "serviceKinds", required: true, defaultValue: "regular" },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles" },
      { name: "trailerId", label: "f.trailer", type: "ref", ref: "trailers" },
      { name: "description", label: "f.description", type: "textarea", span: 2 },
      { name: "supplierId", label: "f.workshop", type: "supplier" },
      { name: "odometerKm", label: "f.odometerKm", type: "int" },
      { name: "invoiceNo", label: "f.invoiceNo", type: "text" },
      { name: "amount", label: "f.amount", type: "money", required: true, defaultValue: "RSD" },
      { name: "paid", label: "f.paid", type: "bool", defaultValue: true },
    ],
  },
  parts: {
    title: "r.parts",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "name", label: "f.partName", type: "text", required: true },
      { name: "partNumber", label: "f.partNumber", type: "text" },
      { name: "quantity", label: "f.quantity", type: "int", required: true, defaultValue: 1 },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles" },
      { name: "trailerId", label: "f.trailer", type: "ref", ref: "trailers" },
      { name: "supplierId", label: "f.supplier", type: "supplier" },
      { name: "invoiceNo", label: "f.invoiceNo", type: "text" },
      { name: "amount", label: "f.amount", type: "money", required: true, defaultValue: "RSD" },
      { name: "paid", label: "f.paid", type: "bool", defaultValue: true },
    ],
  },
  fuel: {
    title: "r.fuel",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles", required: true },
      { name: "employeeId", label: "f.driver", type: "ref", ref: "drivers" },
      { name: "liters", label: "f.liters", type: "decimal", required: true },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "EUR" },
      { name: "odometerKm", label: "f.odometerKm", type: "int" },
      { name: "station", label: "f.station", type: "text", placeholder: "OMV, MOL, NIS…" },
      { name: "country", label: "f.country", type: "select", options: "countries", defaultValue: "RS" },
      { name: "payment", label: "f.payment", type: "select", options: "fuelPayment", required: true, defaultValue: "card" },
      { name: "fullTank", label: "f.fullTank", type: "bool", defaultValue: true },
    ],
  },
  payments: {
    title: "r.payments",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "employeeId", label: "f.employee", type: "ref", ref: "employees", required: true },
      { name: "kind", label: "f.kind", type: "select", options: "paymentKinds", required: true, defaultValue: "per_diem" },
      { name: "method", label: "f.method", type: "select", options: "paymentMethods", required: true, defaultValue: "cash" },
      { name: "amount", label: "f.amount", type: "money", required: true, defaultValue: "EUR" },
      { name: "note", label: "f.note", type: "textarea", span: 2 },
    ],
  },
  suppliers: {
    title: "r.suppliers",
    fields: [
      { name: "name", label: "f.name", type: "text", required: true, span: 2 },
      { name: "phone", label: "f.phone", type: "text" },
      { name: "note", label: "f.note", type: "text" },
    ],
  },
};
