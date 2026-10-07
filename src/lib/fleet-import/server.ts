import "server-only";
import ExcelJS from "exceljs";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { can, type Perms } from "@/lib/auth/permissions";
import type { EntityType, Locale, Option } from "@/lib/catalog";
import { ORDER, SHEETS, foldHeader, headerIndex, isDocCol, specOf, type Col, type DocCol, type SheetSpec } from "./spec";
import type { ImportIssue, ImportPreview, ImportResult, ImportSheet, PreviewRow, SheetSummary } from "./types";
import { todayISO } from "@/lib/format";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 3000;

/* ───────────────────────── cell values ───────────────────────── */

type Raw = string | number | boolean | Date | null;

/** ExcelJS cell value → plain value (rich text, formulas, links unwrapped) */
function plain(v: ExcelJS.CellValue): Raw {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return plain((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("error" in v) return null;
  }
  return null;
}

const asText = (v: Raw): string => {
  if (v === null) return "";
  if (v instanceof Date) return isoDate(v) ?? "";
  return String(v).replace(/\s+/g, " ").trim();
};

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  // Excel dates come in as UTC midnight
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > last) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 31.12.2026 · 31.12.2026. · 31/12/26 · 2026-12-31 · 12.2026 (= end of that month) · Excel date or serial */
export function parseDate(v: Raw): string | null {
  if (v === null || v === "") return null;
  if (v instanceof Date) return isoDate(v);
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return isoDate(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000));
    return null;
  }
  const s = String(v).trim().replace(/\s+/g, "").replace(/\.$/, "");
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return validYmd(y, Number(m[2]), Number(m[1]));
  }
  m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:T.*)?$/);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) {
    const y = Number(m[2]);
    const mo = Number(m[1]);
    return mo >= 1 && mo <= 12 ? validYmd(y, mo, new Date(Date.UTC(y, mo, 0)).getUTCDate()) : null;
  }
  if (/^\d{5}$/.test(s)) return parseDate(Number(s));
  return null;
}

/** "412.880 km" → 412880; 2019 → 2019 */
function parseInt0(v: Raw): number | null {
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const digits = String(v).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

const plateOut = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
export const plateKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9ČĆŠŽĐ]/g, "");
const nameKey = (first: string, last: string) => foldHeader(`${first} ${last}`);

function matchOption(col: Col, text: string): string | null {
  const k = foldHeader(text);
  if (!k) return null;
  const opts = col.options ?? [];
  const exact = opts.find((o) => [o.value, o.label.sr, o.label.en].some((x) => foldHeader(x) === k));
  if (exact) return exact.value;
  if (col.synonyms?.[k]) return col.synonyms[k];
  // "Kamion" → "Kamion (solo)": a unique option starting with what was written
  const starts = opts.filter((o: Option) => [o.label.sr, o.label.en].some((x) => foldHeader(x).startsWith(k)));
  return starts.length === 1 ? starts[0].value : null;
}

/* ───────────────────────── reading the workbook ───────────────────────── */

type ReadSheet = {
  spec: SheetSpec;
  name: string;
  /** column number → what it is */
  cols: Map<number, Col | DocCol>;
  ignored: string[];
  rows: { row: number; get: (c: Col | DocCol) => Raw }[];
};

/** The header row is the one (of the first six) that names the most known columns. */
function readSheet(ws: ExcelJS.Worksheet, spec: SheetSpec): ReadSheet | null {
  const index = headerIndex(spec);
  let best: { row: number; cols: Map<number, Col | DocCol>; ignored: string[] } | null = null;
  for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
    const cols = new Map<number, Col | DocCol>();
    const ignored: string[] = [];
    const used = new Set<string>();
    ws.getRow(r).eachCell((cell, c) => {
      const h = asText(plain(cell.value));
      if (!h) return;
      const col = index.get(foldHeader(h));
      if (col && !used.has(col.key)) {
        cols.set(c, col);
        used.add(col.key);
      } else ignored.push(h);
    });
    if (cols.size && (!best || cols.size > best.cols.size)) best = { row: r, cols, ignored };
  }
  if (!best) return null;
  const keys = new Set([...best.cols.values()].map((c) => c.key));
  const hasKey = spec.sheet === "employees" ? (keys.has("firstName") && keys.has("lastName")) || keys.has("fullName") : keys.has("plate");
  if (!hasKey) return null;

  const byKey = new Map([...best.cols.entries()].map(([n, c]) => [c.key, n]));
  const rows: ReadSheet["rows"] = [];
  const last = Math.min(ws.rowCount, best.row + MAX_ROWS);
  for (let r = best.row + 1; r <= last; r++) {
    const row = ws.getRow(r);
    const get = (c: Col | DocCol): Raw => {
      const n = byKey.get(c.key);
      return n ? plain(row.getCell(n).value) : null;
    };
    const empty = [...best.cols.keys()].every((n) => asText(plain(row.getCell(n).value)) === "");
    if (!empty) rows.push({ row: r, get });
  }
  return { spec, name: ws.name, cols: best.cols, ignored: best.ignored, rows };
}

/** Finds each kind of sheet: by its name first, otherwise by what its columns look like. */
function readWorkbook(wb: ExcelJS.Workbook): Partial<Record<ImportSheet, ReadSheet>> {
  const out: Partial<Record<ImportSheet, ReadSheet>> = {};
  const taken = new Set<string>();
  for (const spec of SHEETS) {
    const ws = wb.worksheets.find((w) => !taken.has(w.name) && spec.names.includes(foldHeader(w.name)));
    const read = ws && readSheet(ws, spec);
    if (read) {
      out[spec.sheet] = read;
      taken.add(ws.name);
    }
  }
  // sheets with other names: people first; a plate sheet is a trailer sheet only if it looks like one
  for (const ws of wb.worksheets) {
    if (taken.has(ws.name) || foldHeader(ws.name) === "uputstvo" || foldHeader(ws.name) === "instructions") continue;
    for (const s of ["employees", "trailers", "vehicles"] as const) {
      if (out[s]) continue;
      const read = readSheet(ws, specOf(s));
      if (!read) continue;
      if (s === "trailers" && ![...read.cols.values()].some((c) => c.key === "axles" || c.key === "capacityKg")) continue;
      out[s] = read;
      taken.add(ws.name);
      break;
    }
  }
  return out;
}

/* ───────────────────────── the plan: what will happen ───────────────────────── */

type Values = Record<string, string | number | null>;
type DocPlan = { docType: string; expiresAt: string };
type PlanRow = PreviewRow & { key: string; values: Values; docList: DocPlan[]; existingId: string | null; driverKey?: string | null; trailerKeys?: string[] };

type Existing = {
  vehicles: Map<string, string>;
  trailers: Map<string, string>;
  employees: Map<string, string>;
  /** entityType|entityId|docType|expiresAt */
  docs: Set<string>;
};

async function loadExisting(companyId: string): Promise<Existing> {
  const [v, t, e, d] = await Promise.all([
    db.select({ id: schema.vehicles.id, plate: schema.vehicles.plate }).from(schema.vehicles).where(eq(schema.vehicles.companyId, companyId)),
    db.select({ id: schema.trailers.id, plate: schema.trailers.plate }).from(schema.trailers).where(eq(schema.trailers.companyId, companyId)),
    db.select({ id: schema.employees.id, f: schema.employees.firstName, l: schema.employees.lastName }).from(schema.employees).where(eq(schema.employees.companyId, companyId)),
    db
      .select({ t: schema.documents.entityType, id: schema.documents.entityId, k: schema.documents.docType, x: schema.documents.expiresAt })
      .from(schema.documents)
      .where(eq(schema.documents.companyId, companyId)),
  ]);
  return {
    vehicles: new Map(v.map((x) => [plateKey(x.plate), x.id])),
    trailers: new Map(t.map((x) => [plateKey(x.plate), x.id])),
    employees: new Map(e.map((x) => [nameKey(x.f, x.l), x.id])),
    docs: new Set(d.map((x) => `${x.t}|${x.id}|${x.k}|${x.x}`)),
  };
}

const tr = (sr: boolean, a: string, b: string) => (sr ? a : b);

function planSheet(read: ReadSheet, ex: Existing, sr: boolean, inFile: { employees: Set<string>; trailers: Set<string> }): PlanRow[] {
  const spec = read.spec;
  const seen = new Map<string, number>();
  const out: PlanRow[] = [];
  const existingMap = spec.sheet === "vehicles" ? ex.vehicles : spec.sheet === "trailers" ? ex.trailers : ex.employees;

  for (const r of read.rows) {
    const issues: ImportIssue[] = [];
    const values: Values = {};
    for (const c of read.cols.values()) {
      if (isDocCol(c)) continue;
      const raw = r.get(c);
      const text = asText(raw);
      if (!text) continue;
      const label = c.label[sr ? "sr" : "en"];
      switch (c.kind) {
        case "plate":
          values[c.key] = plateOut(text).slice(0, 20);
          break;
        case "name":
          values[c.key] = text.slice(0, 80);
          break;
        case "text":
          values[c.key] = text.slice(0, 200);
          break;
        case "long":
          values[c.key] = text.slice(0, 2000);
          break;
        case "int": {
          const n = parseInt0(raw);
          if (n === null || (c.range && (n < c.range[0] || n > c.range[1]))) issues.push({ level: "warn", text: tr(sr, `${label}: „${text}“ nije ispravan broj, preskočeno`, `${label}: "${text}" is not a valid number, left out`) });
          else values[c.key] = n;
          break;
        }
        case "date": {
          const d = parseDate(raw);
          if (!d) issues.push({ level: "warn", text: tr(sr, `${label}: „${text}“ nije datum, preskočeno`, `${label}: "${text}" is not a date, left out`) });
          // a download date can't be in the future
          else if (c.key.endsWith("ReadAt") && d > todayISO()) issues.push({ level: "warn", text: tr(sr, `${label}: „${text}“ je u budućnosti, preskočeno`, `${label}: "${text}" is in the future, left out`) });
          else values[c.key] = d;
          break;
        }
        case "option": {
          const v = matchOption(c, text);
          if (!v) issues.push({ level: "warn", text: tr(sr, `${label}: „${text}“ nije prepoznato, ostaje podrazumevano`, `${label}: "${text}" not recognised, default kept`) });
          else values[c.key] = v;
          break;
        }
      }
    }

    // a single "full name" column: the first word is the first name
    if (spec.sheet === "employees" && !values.firstName && !values.lastName && typeof values.fullName === "string") {
      const parts = values.fullName.split(" ");
      values.firstName = parts[0];
      values.lastName = parts.slice(1).join(" ");
    }
    delete values.fullName;
    if (typeof values.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      issues.push({ level: "warn", text: tr(sr, `Email „${values.email}“ nije ispravan, preskočeno`, `Email "${values.email}" is not valid, left out`) });
      delete values.email;
    }

    let key = "";
    let label = "";
    if (spec.sheet === "employees") {
      const f = String(values.firstName ?? "");
      const l = String(values.lastName ?? "");
      label = `${f} ${l}`.trim();
      if (!f || !l) issues.push({ level: "error", text: tr(sr, "Nedostaje ime ili prezime", "First or last name is missing") });
      else key = nameKey(f, l);
    } else {
      label = String(values.plate ?? "");
      if (!values.plate) issues.push({ level: "error", text: tr(sr, "Nedostaje registracija", "Plate is missing") });
      else if (plateKey(String(values.plate)).length < 3) issues.push({ level: "error", text: tr(sr, `Registracija „${values.plate}“ nije ispravna`, `Plate "${values.plate}" is not valid`) });
      else key = plateKey(String(values.plate));
    }
    if (key && seen.has(key)) {
      issues.push({ level: "error", text: tr(sr, `Već postoji u redu ${seen.get(key)} ovog lista`, `Already in row ${seen.get(key)} of this sheet`) });
      key = "";
    } else if (key) seen.set(key, r.row);

    const existingId = key ? (existingMap.get(key) ?? null) : null;

    // documents: only the expiry date is written
    const docList: DocPlan[] = [];
    for (const c of read.cols.values()) {
      if (!isDocCol(c)) continue;
      const raw = r.get(c);
      const text = asText(raw);
      if (!text || /^(-|—|\/|nema|ne|n\/a|x)$/i.test(text)) continue;
      const d = parseDate(raw);
      if (!d) {
        issues.push({ level: "warn", text: tr(sr, `${c.label.sr}: „${text}“ nije datum, preskočeno`, `${c.label.en}: "${text}" is not a date, left out`) });
        continue;
      }
      if (existingId && ex.docs.has(`${spec.entity}|${existingId}|${c.docType}|${d}`)) continue; // already there
      docList.push({ docType: c.docType, expiresAt: d });
    }

    // links from a truck to its driver and trailers
    let driverKey: string | null = null;
    let trailerKeys: string[] = [];
    if (spec.sheet === "vehicles") {
      if (typeof values.driver === "string") {
        const k = foldHeader(values.driver);
        if (ex.employees.has(k) || inFile.employees.has(k)) driverKey = k;
        else issues.push({ level: "warn", text: tr(sr, `Vozač „${values.driver}“ nije pronađen, kamion se uvozi bez vozača`, `Driver "${values.driver}" not found, the truck is imported without a driver`) });
      }
      if (typeof values.trailers === "string") {
        for (const p of values.trailers.split(/[,;/+]+/).map((x) => x.trim()).filter(Boolean)) {
          const k = plateKey(p);
          if (ex.trailers.has(k) || inFile.trailers.has(k)) trailerKeys.push(k);
          else issues.push({ level: "warn", text: tr(sr, `Prikolica „${p}“ nije pronađena, nije povezana`, `Trailer "${p}" not found, not linked`) });
        }
        trailerKeys = [...new Set(trailerKeys)];
      }
      delete values.driver;
      delete values.trailers;
    }

    const error = issues.some((i) => i.level === "error");
    out.push({
      sheet: spec.sheet,
      row: r.row,
      label: label || "—",
      action: error ? "error" : existingId ? "update" : "new",
      docs: error ? 0 : docList.length,
      issues,
      key,
      values,
      docList,
      existingId,
      driverKey,
      trailerKeys,
    });
  }
  return out;
}

type Plan = { sheets: SheetSummary[]; rows: PlanRow[]; docsAllowed: boolean };

async function makePlan(buf: ArrayBuffer, companyId: string, perms: Perms, locale: Locale): Promise<Plan | { error: string }> {
  const sr = locale === "sr";
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return { error: tr(sr, "Ovo nije Excel (.xlsx) fajl. U Excelu izaberi Sačuvaj kao → Excel radna sveska (.xlsx).", "This is not an Excel (.xlsx) file. In Excel choose Save as → Excel Workbook (.xlsx).") };
  }
  const read = readWorkbook(wb);
  if (!read.vehicles && !read.trailers && !read.employees) {
    return { error: tr(sr, "U fajlu nisam našao listove Kamioni, Prikolice ili Vozači (ni kolone Registracija / Ime i Prezime). Najlakše je da preuzmeš šablon i popuniš ga.", "No Trucks, Trailers or Drivers sheet found (nor Plate / First and last name columns). The easiest way is to download the template and fill it in.") };
  }
  const ex = await loadExisting(companyId);
  const docsAllowed = can(perms, "documents", "edit");
  const allowed = (s: ImportSheet) => can(perms, specOf(s).module, "edit");

  // what the file itself adds, so trucks can link to drivers/trailers from the same file
  const inFile = { employees: new Set<string>(), trailers: new Set<string>() };
  const rows: PlanRow[] = [];
  const sheets: SheetSummary[] = [];
  for (const s of ORDER) {
    const r = read[s];
    const summary: SheetSummary = { sheet: s, name: r?.name ?? null, allowed: allowed(s), added: 0, updated: 0, errors: 0, docs: 0, ignored: r?.ignored ?? [] };
    sheets.push(summary);
    if (!r || !summary.allowed) continue;
    const planned = planSheet(r, ex, sr, inFile);
    for (const p of planned) {
      if (!docsAllowed) {
        p.docList = [];
        p.docs = 0;
      }
      if (p.action !== "error" && p.key && s !== "vehicles") inFile[s].add(p.key);
      if (p.action === "new") summary.added++;
      else if (p.action === "update") summary.updated++;
      else summary.errors++;
      summary.docs += p.docs;
    }
    rows.push(...planned);
  }
  return { sheets, rows, docsAllowed };
}

export async function previewImport(buf: ArrayBuffer, companyId: string, perms: Perms, locale: Locale): Promise<ImportPreview> {
  const plan = await makePlan(buf, companyId, perms, locale);
  if ("error" in plan) return { ok: false, message: plan.error };
  return {
    ok: true,
    docsAllowed: plan.docsAllowed,
    sheets: plan.sheets,
    // the client only needs what it shows
    rows: plan.rows.map(({ sheet, row, label, action, docs, issues }) => ({ sheet, row, label, action, docs, issues })),
  };
}

/* ───────────────────────── writing ───────────────────────── */

const FIELDS: Record<ImportSheet, string[]> = {
  vehicles: ["plate", "type", "brand", "model", "year", "euroNorm", "vin", "odometerKm", "tachoReadAt", "status", "wialonUnitId", "notes"],
  trailers: ["plate", "type", "brand", "year", "vin", "axles", "capacityKg", "status", "notes"],
  employees: ["firstName", "lastName", "role", "status", "phone", "email", "hiredAt", "cardReadAt", "notes"],
};

/** Adds new records and fills in existing ones (a blank cell never erases anything). */
export async function commitImport(buf: ArrayBuffer, companyId: string, perms: Perms, locale: Locale): Promise<ImportResult & { counts?: Record<string, number> }> {
  const plan = await makePlan(buf, companyId, perms, locale);
  if ("error" in plan) return { ok: false, message: plan.error };
  const good = plan.rows.filter((r) => r.action !== "error");
  if (!good.length) return { ok: false, message: locale === "sr" ? "Nema nijednog reda za uvoz." : "Nothing to import." };

  let added = 0;
  let updated = 0;
  let docs = 0;
  await db.transaction(async (tx) => {
    const ids: Record<ImportSheet, Map<string, string>> = { employees: new Map(), trailers: new Map(), vehicles: new Map() };
    const tables = { vehicles: schema.vehicles, trailers: schema.trailers, employees: schema.employees } as const;
    const entityOf: Record<ImportSheet, EntityType> = { vehicles: "vehicle", trailers: "trailer", employees: "employee" };

    for (const s of ORDER) {
      const T = tables[s];
      for (const r of good.filter((x) => x.sheet === s)) {
        const set: Record<string, unknown> = {};
        for (const f of FIELDS[s]) if (r.values[f] !== undefined && r.values[f] !== null) set[f] = r.values[f];
        if (s === "vehicles" && r.driverKey) {
          const d = ids.employees.get(r.driverKey);
          if (d) set.driverId = d;
        }
        let id = r.existingId;
        if (id) {
          if (Object.keys(set).length) await tx.update(T).set(set as never).where(and(eq(T.id, id), eq(T.companyId, companyId)));
          updated++;
        } else {
          const [row] = await tx
            .insert(T)
            .values({ ...set, companyId } as never)
            .returning({ id: T.id });
          id = row.id;
          added++;
        }
        ids[s].set(r.key, id);

        if (s === "vehicles" && r.trailerKeys?.length) {
          const tIds = r.trailerKeys.map((k) => ids.trailers.get(k)).filter((x): x is string => !!x);
          if (tIds.length) await tx.insert(schema.vehicleTrailers).values(tIds.map((trailerId) => ({ companyId, vehicleId: id!, trailerId }))).onConflictDoNothing();
        }
        if (r.docList.length) {
          await tx.insert(schema.documents).values(r.docList.map((d) => ({ companyId, entityType: entityOf[s], entityId: id!, docType: d.docType, expiresAt: d.expiresAt })));
          docs += r.docList.length;
        }
      }
      // existing people/trailers that the file does not list can still be linked to
      if (s === "employees") {
        const ex = await tx.select({ id: schema.employees.id, f: schema.employees.firstName, l: schema.employees.lastName }).from(schema.employees).where(eq(schema.employees.companyId, companyId));
        for (const e of ex) if (!ids.employees.has(nameKey(e.f, e.l))) ids.employees.set(nameKey(e.f, e.l), e.id);
      }
      if (s === "trailers") {
        const ex = await tx.select({ id: schema.trailers.id, plate: schema.trailers.plate }).from(schema.trailers).where(eq(schema.trailers.companyId, companyId));
        for (const t of ex) if (!ids.trailers.has(plateKey(t.plate))) ids.trailers.set(plateKey(t.plate), t.id);
      }
    }
  });
  return { ok: true, added, updated, docs, skipped: plan.rows.length - good.length };
}

/* ───────────────────────── the template ───────────────────────── */

const GREY = "FF6B7280";

/** Range-wide drop-downs / date checks (in ExcelJS 4 but missing from its types). */
const validations = (ws: ExcelJS.Worksheet) => (ws as unknown as { dataValidations: { add: (range: string, v: ExcelJS.DataValidation) => void } }).dataValidations;
const LINE = "FFE5E7EB";

/** The workbook people download: instructions + one sheet per kind, with what the company already has. */
export async function buildTemplate(companyId: string, perms: Perms, locale: Locale): Promise<Buffer> {
  const sr = locale === "sr";
  const L = (x: { sr: string; en: string }) => (sr ? x.sr : x.en);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Roadline";
  wb.created = new Date();

  // instructions first
  const help = wb.addWorksheet(sr ? "Uputstvo" : "Instructions", { properties: { tabColor: { argb: "FF09CD71" } } });
  help.getColumn(1).width = 4;
  help.getColumn(2).width = 110;
  const lines: [string, boolean?][] = sr
    ? [
        ["Uvoz flote u Roadline", true],
        [""],
        ["1.  Popuni listove Kamioni, Prikolice i Vozači. Jedan red je jedan kamion, jedna prikolica ili jedan vozač."],
        ["2.  Obavezna je samo registracija (kamioni i prikolice), odnosno ime i prezime (vozači). Sve ostalo može da ostane prazno."],
        ["3.  Za dokumenta (zelene kolone) upiši samo datum isteka, npr. 31.12.2026. Prazno polje znači da tog dokumenta nema."],
        ["4.  Kod kamiona u koloni Vozač upiši ime i prezime vozača, a u koloni Prikolica registraciju prikolice. Tako se povežu."],
        ["5.  Ako kamion, prikolica ili vozač već postoji u Roadline-u (ista registracija, isto ime i prezime), podaci se dopunjuju, ne pravi se duplikat. Prazno polje ništa ne briše."],
        ["6.  Sačuvaj fajl i vrati ga u Roadline (Podešavanja → Uvoz iz Excela). Pre upisa vidiš šta će biti dodato, a šta ne valja."],
        [""],
        ["Tip i status biraš sa padajuće liste. Ako ih ostaviš prazne: tegljač / cerada / vozač, aktivno."],
        ["Možeš da obrišeš kolone koje ti ne trebaju. Redosled kolona nije bitan."],
      ]
    : [
        ["Fleet import for Roadline", true],
        [""],
        ["1.  Fill in the Trucks, Trailers and Drivers sheets. One row is one truck, one trailer or one driver."],
        ["2.  Only the plate (trucks and trailers) and the first and last name (drivers) are required. Everything else may stay empty."],
        ["3.  For documents (green columns) write only the expiry date, e.g. 31.12.2026. An empty cell means there is no such document."],
        ["4.  For trucks, write the driver's first and last name in the Driver column and the trailer plate in the Trailer column. That links them."],
        ["5.  If a truck, trailer or driver already exists in Roadline (same plate, same name), it is filled in, not duplicated. An empty cell erases nothing."],
        ["6.  Save the file and upload it to Roadline (Settings → Import from Excel). You see what will be added and what is wrong before anything is saved."],
        [""],
        ["Type and status come from a drop-down. Left empty: tractor / curtainsider / driver, active."],
        ["You may delete columns you don't need. Column order doesn't matter."],
      ];
  lines.forEach(([text, title], i) => {
    const c = help.getCell(i + 2, 2);
    c.value = text;
    c.font = title ? { bold: true, size: 15 } : { size: 11 };
    c.alignment = { wrapText: true, vertical: "top" };
  });

  // what the company already has, so the file can also be used to fill in gaps
  const latestDocs = new Map<string, string>();
  const docRows = can(perms, "documents", "view")
    ? await db
        .select({ t: schema.documents.entityType, id: schema.documents.entityId, k: schema.documents.docType, x: schema.documents.expiresAt })
        .from(schema.documents)
        .where(eq(schema.documents.companyId, companyId))
    : [];
  for (const d of docRows) {
    if (!d.x) continue;
    const k = `${d.t}|${d.id}|${d.k}`;
    if (!latestDocs.has(k) || latestDocs.get(k)! < d.x) latestDocs.set(k, d.x);
  }
  const canView = (s: ImportSheet) => can(perms, specOf(s).module, "view");
  const employees = canView("employees") ? await db.select().from(schema.employees).where(eq(schema.employees.companyId, companyId)) : [];
  const trailers = canView("trailers") ? await db.select().from(schema.trailers).where(eq(schema.trailers.companyId, companyId)) : [];
  const vehicles = canView("vehicles") ? await db.select().from(schema.vehicles).where(eq(schema.vehicles.companyId, companyId)) : [];
  const links = vehicles.length
    ? await db.select().from(schema.vehicleTrailers).where(and(eq(schema.vehicleTrailers.companyId, companyId), inArray(schema.vehicleTrailers.vehicleId, vehicles.map((v) => v.id))))
    : [];
  const empName = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const trlPlate = new Map(trailers.map((t) => [t.id, t.plate]));

  const toDate = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00Z`) : null);
  const optLabel = (c: Col, v: unknown) => c.options?.find((o) => o.value === v)?.label[sr ? "sr" : "en"] ?? (v as string) ?? null;

  const existingRows = (s: ImportSheet): { id: string; get: (c: Col) => unknown }[] => {
    if (s === "employees") return employees.map((e) => ({ id: e.id, get: (c) => (c.key === "hiredAt" ? toDate(e.hiredAt) : c.key === "cardReadAt" ? toDate(e.cardReadAt) : (e as Record<string, unknown>)[c.key]) }));
    if (s === "trailers") return trailers.map((t) => ({ id: t.id, get: (c) => (t as Record<string, unknown>)[c.key] }));
    return vehicles.map((v) => ({
      id: v.id,
      get: (c) =>
        c.key === "driver"
          ? v.driverId
            ? empName.get(v.driverId)
            : null
          : c.key === "trailers"
            ? links
                .filter((l) => l.vehicleId === v.id)
                .map((l) => trlPlate.get(l.trailerId))
                .filter(Boolean)
                .join(", ") || null
            : c.key === "tachoReadAt"
              ? toDate(v.tachoReadAt)
              : (v as Record<string, unknown>)[c.key],
    }));
  };

  for (const spec of [specOf("vehicles"), specOf("trailers"), specOf("employees")]) {
    const ws = wb.addWorksheet(L(spec.title), { views: [{ state: "frozen", ySplit: 2, xSplit: 1 }] });
    const cols = spec.cols.filter((c) => !c.parseOnly);
    const docs = can(perms, "documents", "view") ? spec.docs : [];
    const all: (Col | DocCol)[] = [...cols, ...docs];

    // row 1: groups · row 2: headers
    ws.getRow(1).height = 22;
    ws.getRow(2).height = 34;
    ws.mergeCells(1, 1, 1, cols.length);
    const g1 = ws.getCell(1, 1);
    g1.value = L(spec.group);
    g1.font = { bold: true, color: { argb: GREY } };
    g1.alignment = { vertical: "middle" };
    if (docs.length) {
      ws.mergeCells(1, cols.length + 1, 1, all.length);
      const g2 = ws.getCell(1, cols.length + 1);
      g2.value = sr ? "Dokumenta: upiši datum isteka (npr. 31.12.2026)" : "Documents: write the expiry date (e.g. 31.12.2026)";
      g2.font = { bold: true, color: { argb: "FF047857" } };
      g2.alignment = { vertical: "middle" };
    }

    all.forEach((c, i) => {
      const n = i + 1;
      const doc = isDocCol(c);
      const cell = ws.getCell(2, n);
      cell.value = `${L(c.label)}${!doc && (c as Col).required ? " *" : ""}`;
      cell.font = { bold: true, color: { argb: "FF111827" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: doc ? "FFDCFCE7" : "FFF3F4F6" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } }, right: { style: "thin", color: { argb: LINE } } };
      const col = ws.getColumn(n);
      col.width = doc ? Math.max(14, Math.min(24, L(c.label).length * 0.9)) : ((c as Col).width ?? 14);
      if (!doc && (c as Col).note) cell.note = L((c as Col).note!);

      const isDate = doc || (c as Col).kind === "date";
      const range = `${col.letter}3:${col.letter}${MAX_ROWS + 2}`;
      if (isDate) {
        col.numFmt = "dd.mm.yyyy";
        validations(ws).add(range, {
          type: "date",
          operator: "greaterThan",
          allowBlank: true,
          formulae: [new Date(Date.UTC(1990, 0, 1))],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: sr ? "Datum" : "Date",
          error: sr ? "Upiši datum, npr. 31.12.2026" : "Write a date, e.g. 31.12.2026",
        });
      } else if ((c as Col).kind === "option") {
        const list = (c as Col).options!.map((o) => L(o.label).replace(/,/g, " ")).join(",");
        validations(ws).add(range, { type: "list", allowBlank: true, formulae: [`"${list}"`], showErrorMessage: true, errorStyle: "warning", error: sr ? "Izaberi sa liste" : "Pick from the list" });
      } else if ((c as Col).kind === "plate" || (c as Col).key === "vin" || (c as Col).key === "wialonUnitId" || (c as Col).key === "phone") {
        col.numFmt = "@"; // keep as text (leading zeros, long numbers)
      }
    });

    existingRows(spec.sheet).forEach((r, i) => {
      const row = ws.getRow(i + 3);
      all.forEach((c, j) => {
        let v: unknown;
        if (isDocCol(c)) v = toDate(latestDocs.get(`${spec.entity}|${r.id}|${c.docType}`));
        else {
          v = r.get(c);
          if (c.kind === "option") v = optLabel(c, v);
        }
        if (v !== null && v !== undefined && v !== "") row.getCell(j + 1).value = v as ExcelJS.CellValue;
      });
    });
  }
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
