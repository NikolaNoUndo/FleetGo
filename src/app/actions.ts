"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { RESOURCES, type ResourceKey } from "@/lib/resources";
import { assertAccess, getContext } from "@/lib/auth/context";
import { can, canSuppliers, RESOURCE_MODULE } from "@/lib/auth/permissions";
import { setSessionCompany } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { getNbsRate } from "@/lib/fx";
import { DOC_TYPES, OPTION_SETS, type EntityType } from "@/lib/catalog";
import { getPositions, normalizeWialonHost } from "@/lib/telematics";
import { resolveLocation, validLatLng } from "@/lib/geo";
import { addMonthsDate, MAX_SPREAD } from "@/lib/expenses";
import { asPlaceKind } from "@/lib/places";

const TABLES = {
  vehicles: schema.vehicles,
  trailers: schema.trailers,
  employees: schema.employees,
  documents: schema.documents,
  services: schema.services,
  parts: schema.parts,
  fuel: schema.fuelEntries,
  payments: schema.driverPayments,
  suppliers: schema.suppliers,
  places: schema.places,
  expenses: schema.expenses,
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
  /** supplier fields: an existing id, or "new:<name>" to create one on save */
  const supplierFields: { field: string; value: string }[] = [];
  /** many-to-many links (vehicle ↔ trailer), written to vehicle_trailers after save */
  let links: string[] | null = null;
  /** places: raw "Coordinates or map link" text, resolved to lat/lng on save */
  let coords: string | null = null;

  for (const f of RESOURCES[resource].fields) {
    const v = raw[f.name];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");

    if (f.type === "coords") {
      coords = String(v ?? "").slice(0, 2000);
      continue;
    }

    if (f.type === "links") {
      const ids = [...new Set(String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 50);
      if (ids.some((x) => !UUID.test(x))) {
        errors[f.name] = "ref";
        continue;
      }
      links = ids;
      for (const id of ids) refChecks.push({ table: f.ref as "vehicles" | "trailers", id, field: f.name });
      continue;
    }

    // Main driver + extra drivers (second, third…), sent as a comma-separated list.
    if (f.type === "drivers") {
      const main = empty ? "" : String(v).trim();
      const extras = String(raw.extraDriverIds ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const all = [main, ...extras].filter(Boolean);
      if (all.some((x) => !UUID.test(x))) {
        errors[f.name] = "ref";
        continue;
      }
      const unique = [...new Set(all)].slice(0, 6);
      out[f.name] = unique[0] ?? null;
      out.extraDriverIds = unique.slice(1);
      for (const id of unique) refChecks.push({ table: "employees", id, field: f.name });
      continue;
    }

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
      case "month":
        // <input type="month"> gives "2026-11"; stored as the first day of that month
        if (!/^\d{4}-\d{2}$/.test(s.slice(0, 7))) errors[f.name] = "date";
        else out[f.name] = `${s.slice(0, 7)}-01`;
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
      case "supplier":
        supplierFields.push({ field: f.name, value: s.slice(0, 200) });
        break;
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
  return { out, errors, refChecks, supplierFields, links, coords };
}

/** Access check for an editable resource; returns the company id. */
async function editContext(resource: ResourceKey) {
  const ctx = await getContext();
  if (!ctx) throw new Error("Not signed in");
  const ok = resource === "suppliers" || resource === "places" ? canSuppliers(ctx.perms, "edit") : can(ctx.perms, RESOURCE_MODULE[resource], "edit");
  if (!ok) throw new Error("Forbidden");
  return ctx;
}

/** Resolve a supplier field value to an id, creating the supplier when it is new. */
async function resolveSupplier(companyId: string, value: string): Promise<string | null> {
  if (value.startsWith("new:")) {
    const name = value.slice(4).trim().replace(/\s+/g, " ");
    if (!name) return null;
    const [existing] = await db
      .select({ id: schema.suppliers.id })
      .from(schema.suppliers)
      .where(and(eq(schema.suppliers.companyId, companyId), eq(schema.suppliers.name, name)))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await db.insert(schema.suppliers).values({ companyId, name }).returning({ id: schema.suppliers.id });
    return created.id;
  }
  if (!UUID.test(value)) return null;
  const [found] = await db
    .select({ id: schema.suppliers.id })
    .from(schema.suppliers)
    .where(and(eq(schema.suppliers.id, value), eq(schema.suppliers.companyId, companyId)))
    .limit(1);
  return found?.id ?? null;
}

/** Replaces the vehicle ↔ trailer links of one vehicle (or one trailer). */
async function syncLinks(resource: ResourceKey, companyId: string, id: string, ids: string[]) {
  const T = schema.vehicleTrailers;
  const own = resource === "vehicles" ? T.vehicleId : resource === "trailers" ? T.trailerId : null;
  if (!own) return;
  await db.delete(T).where(and(eq(T.companyId, companyId), eq(own, id)));
  if (!ids.length) return;
  await db
    .insert(T)
    .values(ids.map((other) => (resource === "vehicles" ? { companyId, vehicleId: id, trailerId: other } : { companyId, vehicleId: other, trailerId: id })))
    .onConflictDoNothing();
}

export async function saveRecord(resourceName: string, id: string | null, raw: Record<string, unknown>): Promise<ActionResult> {
  if (!isResource(resourceName)) return { ok: false, errors: {}, message: "Unknown resource" };
  let companyId: string;
  try {
    companyId = (await editContext(resourceName)).company.id;
  } catch {
    return { ok: false, errors: {}, message: "Nemaš pravo izmene za ovaj deo aplikacije." };
  }
  const { out, errors, refChecks, supplierFields, links, coords } = coerce(resourceName, raw);
  if (Object.keys(errors).length) return { ok: false, errors };
  if (resourceName === "places") {
    // coordinates come from the typed pair, a map link or the address; checked before
    // anything (like a new supplier) is written
    const loc = await resolveLocation(coords ?? "", String(out.address ?? ""));
    if (!loc) return { ok: false, errors: { coords: "coords" } };
    out.lat = loc.lat;
    out.lng = loc.lng;
    if (!out.name && !supplierFields.some((f) => f.value)) return { ok: false, errors: { name: "required" } };
  }
  for (const sf of supplierFields) out[sf.field] = await resolveSupplier(companyId, sf.value);

  if (resourceName === "expenses") {
    // a monthly cost is counted month by month, so it is never spread or shifted
    const date = String(out.date);
    if (out.recurring) {
      out.costFrom = null;
      out.spreadMonths = 1;
      if (out.recurringUntil && String(out.recurringUntil) < date) return { ok: false, errors: { recurringUntil: "date" } };
      let prevNext: string | null = null;
      let prevDate: string | null = null;
      if (id && UUID.test(id)) {
        const E = schema.expenses;
        const [prev] = await db.select({ next: E.recurringNext, date: E.date, recurring: E.recurring }).from(E).where(and(eq(E.id, id), eq(E.companyId, companyId))).limit(1);
        if (prev?.recurring) [prevNext, prevDate] = [prev.next, prev.date];
      }
      // keep the schedule unless the template's date moved
      out.recurringNext = prevNext && prevDate === date ? prevNext : addMonthsDate(date, 1);
    } else {
      out.recurringUntil = null;
      out.recurringNext = null;
      const n = Number(out.spreadMonths ?? 1);
      if (!Number.isInteger(n) || n < 1 || n > MAX_SPREAD) return { ok: false, errors: { spreadMonths: "number" } };
      out.spreadMonths = n;
    }
  }

  if (resourceName === "places") {
    // the name defaults to the supplier's name ("Rapidex")
    if (!out.name && out.supplierId) {
      const [sup] = await db.select({ name: schema.suppliers.name }).from(schema.suppliers).where(eq(schema.suppliers.id, String(out.supplierId))).limit(1);
      out.name = sup?.name ?? null;
    }
    if (!out.name) return { ok: false, errors: { name: "required" } };

    // diesel price (fuel stations only), three decimals; the "updated" time moves only
    // when the price or currency actually changes
    if (out.kind !== "pump") Object.assign(out, { dieselPrice: null, priceCurrency: null, priceUpdatedAt: null });
    else {
      const price = parseNumber(raw.dieselPrice);
      if (price !== null && (Number.isNaN(price) || price < 0 || price > 100_000)) return { ok: false, errors: { dieselPrice: "number" } };
      out.dieselPrice = price === null ? null : Math.round(price * 1000) / 1000;
      out.priceCurrency = price === null ? null : (out.priceCurrency ?? "EUR");
      let changed = true;
      if (id && UUID.test(id)) {
        const P = schema.places;
        const [prev] = await db.select({ p: P.dieselPrice, c: P.priceCurrency }).from(P).where(and(eq(P.id, id), eq(P.companyId, companyId))).limit(1);
        changed = !prev || prev.p !== out.dieselPrice || (prev.c ?? null) !== out.priceCurrency;
      }
      if (out.dieselPrice === null) out.priceUpdatedAt = null;
      else if (changed) out.priceUpdatedAt = new Date();
    }
  }

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
      if (links) await syncLinks(resourceName, companyId, res[0].id, links);
      revalidatePath("/", "layout");
      return { ok: true, id: res[0].id };
    }
    const res = await db
      .insert(table)
      .values({ ...(out as object), companyId } as never)
      .returning({ id: table.id });
    const newId = (res as { id: string }[])[0].id;
    if (links) await syncLinks(resourceName, companyId, newId, links);
    revalidatePath("/", "layout");
    return { ok: true, id: newId };
  } catch (e) {
    const msg = String((e as { cause?: { message?: string } })?.cause?.message ?? (e as Error).message);
    if (resourceName === "suppliers" && msg.includes("suppliers_company_name_uq")) return { ok: false, errors: { name: "duplicate" } };
    console.error("saveRecord failed", e);
    return { ok: false, errors: {}, message: "Database error" };
  }
}

export async function deleteRecord(resourceName: string, id: string): Promise<{ ok: boolean }> {
  if (!isResource(resourceName) || !UUID.test(id)) return { ok: false };
  let ctx;
  try {
    ctx = await editContext(resourceName);
  } catch {
    return { ok: false };
  }
  const companyId = ctx.company.id;
  const table = TABLES[resourceName];
  await db.delete(table).where(and(eq(table.id, id), eq(table.companyId, companyId)));
  // Documents are polymorphic, so clean them up with their owner.
  const entityType = ({ vehicles: "vehicle", trailers: "trailer", employees: "employee" } as Record<string, string>)[resourceName];
  if (entityType) {
    await db
      .delete(schema.documents)
      .where(and(eq(schema.documents.companyId, companyId), eq(schema.documents.entityType, entityType), inArray(schema.documents.entityId, [id])));
  }
  if (resourceName === "employees") {
    // drop the person from any vehicle's extra drivers
    await db
      .update(schema.vehicles)
      .set({ extraDriverIds: sql`array_remove(${schema.vehicles.extraDriverIds}, ${id}::uuid)` })
      .where(and(eq(schema.vehicles.companyId, companyId), sql`${id}::uuid = any(${schema.vehicles.extraDriverIds})`));
  }
  if (["vehicles", "trailers", "employees"].includes(resourceName)) await audit(ctx.user.email, `delete.${resourceName}`, { id }, companyId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPreference(key: "locale" | "currency", value: string) {
  const c = await cookies();
  if (key === "locale" && (value === "sr" || value === "en")) c.set("rl_locale", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  if (key === "currency" && (value === "EUR" || value === "RSD")) c.set("rl_currency", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function saveSettings(raw: { name: string; pib: string; address: string; eurRsdRate: string; warnDays: string; rateMode: string }) {
  const ctx = await assertAccess("settings", "edit");
  const rate = parseNumber(raw.eurRsdRate);
  const warn = parseNumber(raw.warnDays);
  const rateMode = raw.rateMode === "manual" ? "manual" : "nbs";
  const errors: Record<string, string> = {};
  if (!raw.name?.trim()) errors.name = "required";
  if (rateMode === "manual" && (rate === null || Number.isNaN(rate) || rate <= 0)) errors.eurRsdRate = "number";
  if (warn === null || Number.isNaN(warn) || warn < 1 || warn > 365) errors.warnDays = "number";
  if (Object.keys(errors).length) return { ok: false as const, errors };
  await db
    .update(schema.companies)
    .set({
      name: raw.name.trim(),
      pib: raw.pib?.trim() || null,
      address: raw.address?.trim() || null,
      rateMode,
      ...(rate && !Number.isNaN(rate) && rate > 0 ? { eurRsdRate: rate } : {}),
      warnDays: Math.round(warn!),
    })
    .where(eq(schema.companies.id, ctx.company.id));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Re-read today's NBS rate (shown in Settings). */
export async function refreshRate() {
  await assertAccess("settings", "view");
  return getNbsRate();
}

/** Switch the active company (only to one the user is a member of). */
export async function switchCompany(companyId: string) {
  const ctx = await getContext();
  if (!ctx || !UUID.test(companyId)) return { ok: false };
  if (!ctx.companies.some((c) => c.id === companyId)) return { ok: false };
  await setSessionCompany(companyId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function testTelematics() {
  const ctx = await assertAccess("live", "view");
  const companyId = ctx.company.id;
  const vs = await db
    .select({ id: schema.vehicles.id, plate: schema.vehicles.plate, wialonUnitId: schema.vehicles.wialonUnitId })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.companyId, companyId));
  const res = await getPositions({ token: ctx.company.wialonToken, host: ctx.company.wialonHost }, vs.map((v) => ({ ...v, driverName: null })));
  return {
    source: res.source,
    error: res.error ?? null,
    units: res.positions.length,
    matched: res.positions.filter((p) => p.vehicleId).length,
    // Units not linked to any vehicle, so the owner can see which ID to enter.
    unmatched: res.positions
      .filter((p) => !p.vehicleId)
      .slice(0, 30)
      .map((p) => ({ name: p.unitName, id: p.unitId, uid: p.uid ?? null })),
  };
}

/**
 * Saves (or removes) this company's Wialon token. The token is stored server-side
 * only; the browser only ever sees whether one is set and its last 4 characters.
 */
export async function saveTelematics(input: { token?: string; host?: string; remove?: boolean }): Promise<{ ok: boolean; error?: "token" | "host" }> {
  const ctx = await assertAccess("settings", "edit");
  if (input.remove) {
    await db.update(schema.companies).set({ wialonToken: null, wialonHost: null }).where(eq(schema.companies.id, ctx.company.id));
    await audit(ctx.user.email, "wialon.removed", {}, ctx.company.id);
    revalidatePath("/", "layout");
    return { ok: true };
  }
  // Accept the whole address from Wialon's login page too: …&access_token=XXXX&…
  const raw = input.token?.trim() ?? "";
  const fromUrl = raw.match(/access_token=([A-Za-z0-9]+)/);
  const token = fromUrl ? fromUrl[1] : raw;
  const keepToken = !token && !!ctx.company.wialonToken;
  if (!keepToken && !/^[A-Za-z0-9]{32,128}$/.test(token)) return { ok: false, error: "token" };
  const hostRaw = input.host?.trim() ?? "";
  const host = hostRaw ? normalizeWialonHost(hostRaw) : null;
  if (hostRaw && !host) return { ok: false, error: "host" };
  await db
    .update(schema.companies)
    .set({ ...(keepToken ? {} : { wialonToken: token }), wialonHost: host })
    .where(eq(schema.companies.id, ctx.company.id));
  await audit(ctx.user.email, "wialon.saved", { host: host ?? "hosting" }, ctx.company.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Map places: bulk import (e.g. a Eurowag station list) ---------- */

type ImportRow = {
  name: string;
  address?: string | null;
  phone?: string | null;
  note?: string | null;
  lat: number;
  lng: number;
  dieselPrice?: number | null;
  priceCurrency?: string | null;
  priceUpdatedAt?: string | null;
};
type ImportPrice = { name: string; dieselPrice: number; priceCurrency?: string | null; priceUpdatedAt?: string | null };

const CURRENCY = /^[A-Z]{3}$/;
function importPrice(price: unknown, currency: unknown, fallbackCurrency: string, when: unknown) {
  const p = Number(price);
  if (price === null || price === undefined || price === "" || !Number.isFinite(p) || p <= 0 || p > 100_000) return null;
  const cur = String(currency ?? "").toUpperCase();
  const at = when ? new Date(String(when)) : null;
  return {
    dieselPrice: Math.round(p * 1000) / 1000,
    priceCurrency: CURRENCY.test(cur) ? cur : fallbackCurrency,
    // a date from the file, or now; never in the future
    priceUpdatedAt: at && !Number.isNaN(at.getTime()) && at.getTime() <= Date.now() + 86_400_000 ? at : new Date(),
  };
}

export async function importPlaces(input: {
  kind: string;
  supplier: string;
  replace: boolean;
  currency?: string;
  rows: ImportRow[];
  updates?: ImportPrice[];
}): Promise<{ ok: true; count: number; updated: number; skipped: number; supplierId: string | null } | { ok: false; message: string }> {
  let ctx;
  try {
    ctx = await editContext("places");
  } catch {
    return { ok: false, message: "Nemaš pravo izmene lokacija." };
  }
  const companyId = ctx.company.id;
  const kind = asPlaceKind(String(input.kind));
  const rowsIn = Array.isArray(input.rows) ? input.rows : [];
  const updatesIn = kind === "pump" && Array.isArray(input.updates) ? input.updates : [];
  if (!rowsIn.length && !updatesIn.length) return { ok: false, message: "Fajl nema nijednu lokaciju." };
  if (rowsIn.length + updatesIn.length > 5000) return { ok: false, message: "Najviše 5.000 redova po zahtevu." };
  const fallbackCurrency = CURRENCY.test(String(input.currency ?? "")) ? String(input.currency) : "EUR";
  const supplierId = input.supplier ? await resolveSupplier(companyId, String(input.supplier).slice(0, 200)) : null;

  const clean: (typeof schema.places.$inferInsert)[] = [];
  let skipped = 0;
  for (const r of rowsIn) {
    const lat = Number(r?.lat);
    const lng = Number(r?.lng);
    const name = String(r?.name ?? "").trim().slice(0, 200);
    if (!validLatLng(lat, lng) || !name) {
      skipped++;
      continue;
    }
    const address = String(r?.address ?? "").trim().slice(0, 300) || null;
    const phone = String(r?.phone ?? "").trim().slice(0, 60) || null;
    const note = String(r?.note ?? "").trim().slice(0, 300) || null;
    const price = kind === "pump" ? importPrice(r?.dieselPrice, r?.priceCurrency, fallbackCurrency, r?.priceUpdatedAt) : null;
    clean.push({ companyId, kind, supplierId, name, address, phone, note, lat, lng, ...(price ?? {}) });
  }

  const prices = updatesIn
    .map((u) => ({ name: String(u?.name ?? "").trim().slice(0, 200), price: importPrice(u?.dieselPrice, u?.priceCurrency, fallbackCurrency, u?.priceUpdatedAt) }))
    .filter((u): u is { name: string; price: NonNullable<ReturnType<typeof importPrice>> } => !!u.name && !!u.price);
  skipped += updatesIn.length - prices.length;
  if (!clean.length && !prices.length) return { ok: false, message: "Nijedan red nema naziv i koordinate (ili naziv i cenu)." };

  let updated = 0;
  await db.transaction(async (tx) => {
    const P = schema.places;
    // replacing only makes sense when the file brings the stations themselves
    if (input.replace && clean.length) {
      await tx.delete(P).where(and(eq(P.companyId, companyId), eq(P.kind, kind), supplierId ? eq(P.supplierId, supplierId) : sql`${P.supplierId} is null`));
    }
    for (let i = 0; i < clean.length; i += 1000) await tx.insert(P).values(clean.slice(i, i + 1000));
    // price-only rows: update stations of this supplier with the same name
    for (let i = 0; i < prices.length; i += 500) {
      const values = sql.join(
        prices.slice(i, i + 500).map((u) => sql`(${u.name.toLowerCase()}, ${u.price.dieselPrice}::float8, ${u.price.priceCurrency}, ${u.price.priceUpdatedAt.toISOString()}::timestamptz)`),
        sql`, `,
      );
      const res = await tx.execute(sql`
        update ${P} set diesel_price = v.price, price_currency = v.cur, price_updated_at = v.at
        from (values ${values}) as v(name, price, cur, at)
        where ${P.companyId} = ${companyId} and ${P.kind} = 'pump'
          and ${supplierId ? sql`${P.supplierId} = ${supplierId}` : sql`${P.supplierId} is null`}
          and lower(${P.name}) = v.name`);
      updated += res.rowCount ?? 0;
    }
  });
  await audit(ctx.user.email, "import.places", { kind, count: clean.length, updated, replace: input.replace }, companyId);
  revalidatePath("/", "layout");
  return { ok: true, count: clean.length, updated, skipped, supplierId };
}
