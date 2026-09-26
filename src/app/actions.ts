"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCompanyId } from "@/lib/tenant";
import { RESOURCES, type ResourceKey } from "@/lib/resources";
import { DOC_TYPES, OPTION_SETS, type EntityType } from "@/lib/catalog";
import { getPositions } from "@/lib/telematics";

const TABLES = {
  vehicles: schema.vehicles,
  trailers: schema.trailers,
  employees: schema.employees,
  documents: schema.documents,
  services: schema.services,
  parts: schema.parts,
  fuel: schema.fuelEntries,
  payments: schema.driverPayments,
} as const;

export type ActionResult = { ok: true; id: string } | { ok: false; errors: Record<string, string>; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isResource(x: string): x is ResourceKey {
  return x in RESOURCES;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Validate and coerce raw form values using the resource definition. */
function coerce(resource: ResourceKey, raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const refChecks: { table: "vehicles" | "trailers" | "employees"; id: string; field: string }[] = [];

  for (const f of RESOURCES[resource].fields) {
    const v = raw[f.name];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");

    if (f.type === "bool") {
      out[f.name] = v === true || v === "true" || v === "on";
      continue;
    }
    if (f.type === "money") {
      const cur = String(raw.currency ?? "");
      out.currency = cur === "EUR" || cur === "RSD" ? cur : "RSD";
      if (empty) {
        if (f.required) errors[f.name] = "required";
        out[f.name] = null;
        continue;
      }
      const n = parseNumber(v);
      if (n === null || Number.isNaN(n) || n < 0) errors[f.name] = "number";
      else out[f.name] = Math.round(n * 100) / 100;
      continue;
    }
    if (empty) {
      if (f.required) errors[f.name] = "required";
      out[f.name] = null;
      continue;
    }
    const s = String(v).trim();
    switch (f.type) {
      case "text":
      case "textarea":
        out[f.name] = s.slice(0, f.type === "textarea" ? 2000 : 200);
        break;
      case "int": {
        const n = parseNumber(s);
        if (n === null || Number.isNaN(n)) errors[f.name] = "number";
        else out[f.name] = Math.round(n);
        break;
      }
      case "decimal": {
        const n = parseNumber(s);
        if (n === null || Number.isNaN(n) || n < 0) errors[f.name] = "number";
        else out[f.name] = Math.round(n * 100) / 100;
        break;
      }
      case "date":
        if (!DATE.test(s)) errors[f.name] = "date";
        else out[f.name] = s;
        break;
      case "select": {
        const set = OPTION_SETS[f.options!];
        if (!set.some((o) => o.value === s)) errors[f.name] = "option";
        else out[f.name] = s;
        break;
      }
      case "docType": {
        const et = String(raw.entityType) as EntityType;
        if (!DOC_TYPES[et]?.some((o) => o.value === s)) errors[f.name] = "option";
        else out[f.name] = s;
        break;
      }
      case "ref":
      case "entity": {
        if (!UUID.test(s)) {
          errors[f.name] = "ref";
          break;
        }
        out[f.name] = s;
        const table =
          f.type === "entity"
            ? ({ vehicle: "vehicles", trailer: "trailers", employee: "employees" } as const)[String(raw.entityType) as EntityType]
            : f.ref === "drivers"
              ? "employees"
              : (f.ref as "vehicles" | "trailers" | "employees");
        if (!table) errors[f.name] = "ref";
        else refChecks.push({ table, id: s, field: f.name });
        break;
      }
    }
  }
  return { out, errors, refChecks };
}

export async function saveRecord(resourceName: string, id: string | null, raw: Record<string, unknown>): Promise<ActionResult> {
  if (!isResource(resourceName)) return { ok: false, errors: {}, message: "Unknown resource" };
  const companyId = await getCompanyId();
  const { out, errors, refChecks } = coerce(resourceName, raw);
  if (Object.keys(errors).length) return { ok: false, errors };

  // Tenant safety: every referenced row must belong to the same company.
  for (const r of refChecks) {
    const t = TABLES[r.table];
    const found = await db.select({ id: t.id }).from(t).where(and(eq(t.id, r.id), eq(t.companyId, companyId))).limit(1);
    if (!found.length) return { ok: false, errors: { [r.field]: "ref" } };
  }

  const table = TABLES[resourceName];
  try {
    if (id) {
      if (!UUID.test(id)) return { ok: false, errors: {}, message: "Bad id" };
      const res = await db
        .update(table)
        .set(out as never)
        .where(and(eq(table.id, id), eq(table.companyId, companyId)))
        .returning({ id: table.id });
      if (!res.length) return { ok: false, errors: {}, message: "Not found" };
      revalidatePath("/", "layout");
      return { ok: true, id: res[0].id };
    }
    const res = await db
      .insert(table)
      .values({ ...(out as object), companyId } as never)
      .returning({ id: table.id });
    revalidatePath("/", "layout");
    return { ok: true, id: (res as { id: string }[])[0].id };
  } catch (e) {
    console.error("saveRecord failed", e);
    return { ok: false, errors: {}, message: "Database error" };
  }
}

export async function deleteRecord(resourceName: string, id: string): Promise<{ ok: boolean }> {
  if (!isResource(resourceName) || !UUID.test(id)) return { ok: false };
  const companyId = await getCompanyId();
  const table = TABLES[resourceName];
  await db.delete(table).where(and(eq(table.id, id), eq(table.companyId, companyId)));
  // Documents are polymorphic, so clean them up with their owner.
  const entityType = ({ vehicles: "vehicle", trailers: "trailer", employees: "employee" } as Record<string, string>)[resourceName];
  if (entityType) {
    await db
      .delete(schema.documents)
      .where(and(eq(schema.documents.companyId, companyId), eq(schema.documents.entityType, entityType), inArray(schema.documents.entityId, [id])));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPreference(key: "locale" | "currency", value: string) {
  const c = await cookies();
  if (key === "locale" && (value === "sr" || value === "en")) c.set("fg_locale", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  if (key === "currency" && (value === "EUR" || value === "RSD")) c.set("fg_currency", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function saveSettings(raw: { name: string; pib: string; address: string; eurRsdRate: string; warnDays: string }) {
  const companyId = await getCompanyId();
  const rate = parseNumber(raw.eurRsdRate);
  const warn = parseNumber(raw.warnDays);
  const errors: Record<string, string> = {};
  if (!raw.name?.trim()) errors.name = "required";
  if (rate === null || Number.isNaN(rate) || rate <= 0) errors.eurRsdRate = "number";
  if (warn === null || Number.isNaN(warn) || warn < 1 || warn > 365) errors.warnDays = "number";
  if (Object.keys(errors).length) return { ok: false as const, errors };
  await db
    .update(schema.companies)
    .set({ name: raw.name.trim(), pib: raw.pib?.trim() || null, address: raw.address?.trim() || null, eurRsdRate: rate!, warnDays: Math.round(warn!) })
    .where(eq(schema.companies.id, companyId));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function testTelematics() {
  const companyId = await getCompanyId();
  const vs = await db
    .select({ id: schema.vehicles.id, plate: schema.vehicles.plate, wialonUnitId: schema.vehicles.wialonUnitId })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.companyId, companyId));
  const res = await getPositions(vs.map((v) => ({ ...v, driverName: null })));
  return {
    source: res.source,
    error: res.error ?? null,
    units: res.positions.length,
    matched: res.positions.filter((p) => p.vehicleId).length,
  };
}
