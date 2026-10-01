import "server-only";
import type { AppContext } from "./auth/context";
import { can } from "./auth/permissions";
import { EXPENSE_CATEGORIES, FUEL_PAYMENT, PAYMENT_KINDS, PAYMENT_METHODS, SERVICE_KINDS, COUNTRIES, optLabel, type Currency, type Locale } from "./catalog";
import { fmtDate, fmtMoney, fmtNum, toCurrency, todayISO } from "./format";
import { companyRate } from "./fx";
import { consumptionByVehicle, fullName, listEmployees, listExpenses, listFuel, listParts, listPayments, listServices, listSuppliers, listTrailers, listVehicles } from "./queries";
import { allocationLabel, expenseMonthRows } from "./expenses";

export const REPORT_KINDS = ["fuel", "payments", "services", "expenses", "vehicles"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const PERIODS = ["this_month", "last_month", "this_year", "last_year", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export type ReportParams = {
  kind: ReportKind;
  period: Period;
  from: string;
  to: string;
  vehicle: string;
  driver: string;
  supplier: string;
  paid: "" | "paid" | "unpaid";
};

export type Col = { key: string; label: string; align?: "right"; nowrap?: boolean };
export type Table = { title?: string; columns: Col[]; rows: Record<string, string>[]; foot?: Record<string, string> };
export type Report = {
  kind: ReportKind;
  title: string;
  company: { name: string; pib: string | null; address: string | null };
  periodLabel: string;
  filters: string[];
  summary: { label: string; value: string; sub?: string }[];
  tables: Table[];
  note: string;
  generated: string;
  landscape: boolean;
  empty: boolean;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function periodRange(period: Period, from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "last_month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "this_year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last_year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "custom": {
      const f = from && ISO.test(from) ? from : ymd(new Date(y, m, 1));
      const t = to && ISO.test(to) ? to : todayISO();
      return f <= t ? { from: f, to: t } : { from: t, to: f };
    }
    default:
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
  }
}

/** Reads and validates report options from the URL. */
export function parseReportParams(sp: Record<string, string | string[] | undefined>, allowed: ReportKind[]): ReportParams | null {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const kindRaw = one("kind") as ReportKind;
  const kind = allowed.includes(kindRaw) ? kindRaw : allowed[0];
  if (!kind) return null;
  const period = (PERIODS as readonly string[]).includes(one("period")) ? (one("period") as Period) : "this_month";
  const { from, to } = periodRange(period, one("from"), one("to"));
  const uuidOr = (v: string) => (/^[0-9a-f-]{36}$/i.test(v) ? v : "");
  const paid = one("paid");
  return { kind, period, from, to, vehicle: uuidOr(one("vehicle")), driver: uuidOr(one("driver")), supplier: uuidOr(one("supplier")), paid: paid === "paid" || paid === "unpaid" ? paid : "" };
}

export function allowedReports(ctx: AppContext): ReportKind[] {
  const p = ctx.perms;
  const out: ReportKind[] = [];
  if (can(p, "fuel")) out.push("fuel");
  if (can(p, "payments")) out.push("payments");
  if (can(p, "services") || can(p, "parts")) out.push("services");
  if (can(p, "expenses")) out.push("expenses");
  if (can(p, "vehicles") && (can(p, "fuel") || can(p, "services") || can(p, "parts") || can(p, "expenses"))) out.push("vehicles");
  return out;
}

export const reportTitle = (kind: ReportKind, locale: Locale) =>
  ({
    fuel: { sr: "Izveštaj o sipanju goriva", en: "Fuel report" },
    payments: { sr: "Izveštaj o uplatama vozačima", en: "Driver payments report" },
    services: { sr: "Izveštaj o servisima i delovima", en: "Services and parts report" },
    expenses: { sr: "Izveštaj o ostalim troškovima", en: "Other costs report" },
    vehicles: { sr: "Troškovi po vozilu", en: "Costs per vehicle" },
  })[kind][locale];

export const reportTab = (kind: ReportKind, locale: Locale) =>
  ({
    fuel: { sr: "Gorivo", en: "Fuel" },
    payments: { sr: "Uplate vozačima", en: "Driver payments" },
    services: { sr: "Servisi i delovi", en: "Services and parts" },
    expenses: { sr: "Ostali troškovi", en: "Other costs" },
    vehicles: { sr: "Troškovi po vozilu", en: "Costs per vehicle" },
  })[kind][locale];

/** Builds a ready-to-print report; every value is already formatted for the viewer's language and currency. */
export async function buildReport(ctx: AppContext, p: ReportParams, locale: Locale, currency: Currency): Promise<Report> {
  const L = (sr: string, en: string) => (locale === "sr" ? sr : en);
  const rate = await companyRate(ctx.company);
  const conv = (a: number | null | undefined, from: string) => toCurrency(a ?? 0, from, currency, rate);
  const money = (a: number | null | undefined, c: string) => fmtMoney(a, c, locale, { decimals: 2 });
  const total = (n: number) => fmtMoney(n, currency, locale, { decimals: 2 });
  const num = (n: number | null | undefined, d = 0) => fmtNum(n, locale, d);
  const date = (d: string) => fmtDate(d, locale);
  const inRange = (d: string) => d >= p.from && d <= p.to;
  const perms = ctx.perms;

  const [vehicles, trailers, employees, suppliers] = await Promise.all([listVehicles(), listTrailers(), listEmployees(), listSuppliers()]);
  const plate = new Map<string, string>([...vehicles.map((v) => [v.id, v.plate] as const), ...trailers.map((t) => [t.id, t.plate] as const)]);
  const person = new Map(employees.map((e) => [e.id, fullName(e)]));
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const filters: string[] = [];
  if (p.vehicle) filters.push(`${L("Vozilo", "Vehicle")}: ${plate.get(p.vehicle) ?? "—"}`);
  if (p.driver) filters.push(`${L("Vozač", "Driver")}: ${person.get(p.driver) ?? "—"}`);
  if (p.supplier) filters.push(`${L("Dobavljač", "Supplier")}: ${supplierName.get(p.supplier) ?? "—"}`);
  if (p.paid) filters.push(p.paid === "paid" ? L("Samo plaćeno", "Paid only") : L("Samo neplaćeno", "Unpaid only"));

  /** Sums per original currency, e.g. "€1.200,00 · 45.000 RSD". */
  const byCurrency = (rows: { amount: number | null; currency: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.amount != null) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount);
    return [...m.entries()].map(([c, a]) => money(a, c)).join(" · ") || "—";
  };
  const sumConv = (rows: { amount: number | null; currency: string }[]) => rows.reduce((s, r) => s + conv(r.amount, r.currency), 0);

  const base = {
    kind: p.kind,
    title: reportTitle(p.kind, locale),
    company: { name: ctx.company.name, pib: ctx.company.pib, address: ctx.company.address },
    periodLabel: `${date(p.from)} – ${date(p.to)}`,
    filters,
    note: L(
      `Iznosi su prikazani u valuti u kojoj su plaćeni. Zbirovi su preračunati u ${currency} po kursu 1 EUR = ${num(rate, 4)} RSD.`,
      `Amounts are shown in the currency they were paid in. Totals are converted to ${currency} at 1 EUR = ${num(rate, 4)} RSD.`,
    ),
    generated: `${L("Izradio", "Prepared by")}: ${ctx.user.name ?? ctx.user.email} · ${new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn-RS" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Belgrade" }).format(new Date())}`,
  };

  /* ------------------------------ fuel ------------------------------ */
  if (p.kind === "fuel") {
    const rows = (await listFuel())
      .filter((f) => inRange(f.date) && (!p.vehicle || f.vehicleId === p.vehicle || f.trailerId === p.vehicle) && (!p.driver || f.employeeId === p.driver))
      .sort((a, b) => a.date.localeCompare(b.date));
    const liters = rows.reduce((s, r) => s + r.liters, 0);
    const priced = rows.filter((r) => r.amount != null);
    const pricedL = priced.reduce((s, r) => s + r.liters, 0);
    return {
      ...base,
      landscape: true,
      empty: rows.length === 0,
      summary: [
        { label: L("Broj sipanja", "Refuels"), value: num(rows.length) },
        { label: L("Litara ukupno", "Total litres"), value: `${num(liters, 2)} l` },
        { label: L("Iznos ukupno", "Total amount"), value: total(sumConv(priced)), sub: byCurrency(priced) },
        { label: L("Prosečna cena po litru", "Average price per litre"), value: pricedL ? total(sumConv(priced) / pricedL) : "—", sub: priced.length < rows.length ? L(`${rows.length - priced.length} unosa bez cene`, `${rows.length - priced.length} entries without price`) : undefined },
      ],
      tables: [
        {
          columns: [
            { key: "date", label: L("Datum", "Date"), nowrap: true },
            { key: "vehicle", label: L("Vozilo", "Vehicle"), nowrap: true },
            { key: "driver", label: L("Vozač", "Driver") },
            { key: "liters", label: L("Litara", "Litres"), align: "right", nowrap: true },
            { key: "ppl", label: L("Cena/l", "Price/l"), align: "right", nowrap: true },
            { key: "amount", label: L("Iznos", "Amount"), align: "right", nowrap: true },
            { key: "station", label: L("Pumpa", "Station") },
            { key: "country", label: L("Država", "Country") },
            { key: "km", label: "Km", align: "right", nowrap: true },
            { key: "payment", label: L("Plaćanje", "Payment") },
          ],
          rows: rows.map((r) => ({
            date: date(r.date),
            vehicle: plate.get(r.vehicleId ?? r.trailerId ?? "") ?? "—",
            driver: r.employeeId ? (person.get(r.employeeId) ?? "—") : "—",
            liters: num(r.liters, 2),
            ppl: r.amount != null && r.liters ? money(r.amount / r.liters, r.currency) : "—",
            amount: r.amount != null ? money(r.amount, r.currency) : "—",
            station: r.station ?? "",
            country: r.country ? optLabel(COUNTRIES, r.country, locale) : "",
            km: r.odometerKm ? num(r.odometerKm) : "",
            payment: optLabel(FUEL_PAYMENT, r.payment, locale),
          })),
          foot: { date: L("Ukupno", "Total"), liters: num(liters, 2), amount: total(sumConv(priced)) },
        },
      ],
    };
  }

  /* ---------------------------- payments ---------------------------- */
  if (p.kind === "payments") {
    const rows = (await listPayments()).filter((r) => inRange(r.date) && (!p.driver || r.employeeId === p.driver)).sort((a, b) => a.date.localeCompare(b.date));
    const byDriver = new Map<string, typeof rows>();
    for (const r of rows) byDriver.set(r.employeeId, [...(byDriver.get(r.employeeId) ?? []), r]);
    const kinds = PAYMENT_KINDS.map((k) => k.value).filter((k) => rows.some((r) => r.kind === k));
    const perDriver = [...byDriver.entries()]
      .map(([id, rs]) => ({ id, name: person.get(id) ?? "—", rs, sum: sumConv(rs) }))
      .sort((a, b) => a.name.localeCompare(b.name, "sr"));
    return {
      ...base,
      landscape: false,
      empty: rows.length === 0,
      summary: [
        { label: L("Broj uplata", "Payments"), value: num(rows.length) },
        { label: L("Vozača", "Drivers"), value: num(byDriver.size) },
        { label: L("Ukupno isplaćeno", "Total paid"), value: total(sumConv(rows)), sub: byCurrency(rows) },
      ],
      tables: [
        {
          title: L("Zbirno po vozaču", "Totals per driver"),
          columns: [
            { key: "name", label: L("Vozač", "Driver") },
            { key: "count", label: L("Uplata", "Payments"), align: "right" },
            ...kinds.map((k) => ({ key: `k_${k}`, label: optLabel(PAYMENT_KINDS, k, locale), align: "right" as const, nowrap: true })),
            { key: "sum", label: L("Ukupno", "Total"), align: "right", nowrap: true },
          ],
          rows: perDriver.map((d) => ({
            name: d.name,
            count: num(d.rs.length),
            ...Object.fromEntries(kinds.map((k) => [`k_${k}`, (() => { const x = d.rs.filter((r) => r.kind === k); return x.length ? total(sumConv(x)) : "—"; })()])),
            sum: total(d.sum),
          })),
          foot: {
            name: L("Ukupno", "Total"),
            count: num(rows.length),
            ...Object.fromEntries(kinds.map((k) => [`k_${k}`, total(sumConv(rows.filter((r) => r.kind === k)))])),
            sum: total(sumConv(rows)),
          },
        },
        {
          title: L("Pojedinačne uplate", "Individual payments"),
          columns: [
            { key: "date", label: L("Datum", "Date"), nowrap: true },
            { key: "driver", label: L("Vozač", "Driver") },
            { key: "kind", label: L("Vrsta", "Type") },
            { key: "method", label: L("Način", "Method") },
            { key: "amount", label: L("Iznos", "Amount"), align: "right", nowrap: true },
            { key: "note", label: L("Napomena", "Note") },
          ],
          rows: rows.map((r) => ({
            date: date(r.date),
            driver: person.get(r.employeeId) ?? "—",
            kind: optLabel(PAYMENT_KINDS, r.kind, locale),
            method: optLabel(PAYMENT_METHODS, r.method, locale),
            amount: money(r.amount, r.currency),
            note: r.note ?? "",
          })),
        },
      ],
    };
  }

  /* ------------------------ services and parts ----------------------- */
  if (p.kind === "services") {
    const match = (r: { date: string; vehicleId: string | null; trailerId: string | null; supplierId: string | null; paid: boolean }) =>
      inRange(r.date) &&
      (!p.vehicle || r.vehicleId === p.vehicle || r.trailerId === p.vehicle) &&
      (!p.supplier || r.supplierId === p.supplier) &&
      (!p.paid || (p.paid === "paid" ? r.paid : !r.paid));
    const svc = can(perms, "services") ? (await listServices()).filter(match) : [];
    const prt = can(perms, "parts") ? (await listParts()).filter(match) : [];
    type Row = { date: string; type: string; asset: string; what: string; supplier: string; invoice: string; amount: number | null; currency: string; paid: boolean };
    const rows: Row[] = [
      ...svc.map((r) => ({
        date: r.date,
        type: L("Servis", "Service"),
        asset: plate.get(r.vehicleId ?? r.trailerId ?? "") ?? "—",
        what: [optLabel(SERVICE_KINDS, r.kind, locale), r.description].filter(Boolean).join(" – "),
        supplier: r.supplierId ? (supplierName.get(r.supplierId) ?? "") : "",
        invoice: r.invoiceNo ?? "",
        amount: r.amount,
        currency: r.currency,
        paid: r.paid,
      })),
      ...prt.map((r) => ({
        date: r.date,
        type: L("Deo", "Part"),
        asset: plate.get(r.vehicleId ?? r.trailerId ?? "") ?? "—",
        what: `${r.name}${r.quantity > 1 ? ` × ${r.quantity}` : ""}${r.partNumber ? ` (${r.partNumber})` : ""}`,
        supplier: r.supplierId ? (supplierName.get(r.supplierId) ?? "") : "",
        invoice: r.invoiceNo ?? "",
        amount: r.amount,
        currency: r.currency,
        paid: r.paid,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const unpaid = rows.filter((r) => !r.paid);
    return {
      ...base,
      landscape: true,
      empty: rows.length === 0,
      summary: [
        { label: L("Servisa", "Services"), value: num(svc.length), sub: svc.length ? total(sumConv(svc)) : undefined },
        { label: L("Kupljenih delova", "Parts purchases"), value: num(prt.length), sub: prt.length ? total(sumConv(prt)) : undefined },
        { label: L("Ukupno", "Total"), value: total(sumConv(rows)), sub: byCurrency(rows) },
        { label: L("Nije plaćeno", "Unpaid"), value: total(sumConv(unpaid)), sub: unpaid.length ? L(`${unpaid.length} računa`, `${unpaid.length} invoices`) : undefined },
        ...(rows.some((r) => r.amount === null)
          ? [{ label: L("Bez cene", "No price"), value: num(rows.filter((r) => r.amount === null).length), sub: L("nisu u zbiru", "not in the total") }]
          : []),
      ],
      tables: [
        {
          columns: [
            { key: "date", label: L("Datum", "Date"), nowrap: true },
            { key: "type", label: L("Vrsta", "Type") },
            { key: "asset", label: L("Vozilo / prikolica", "Vehicle / trailer"), nowrap: true },
            { key: "what", label: L("Opis", "Description") },
            { key: "supplier", label: L("Servis / dobavljač", "Workshop / supplier") },
            { key: "invoice", label: L("Račun br.", "Invoice") },
            { key: "amount", label: L("Iznos", "Amount"), align: "right", nowrap: true },
            { key: "paid", label: L("Plaćeno", "Paid") },
          ],
          rows: rows.map((r) => ({
            date: date(r.date),
            type: r.type,
            asset: r.asset,
            what: r.what,
            supplier: r.supplier,
            invoice: r.invoice,
            amount: r.amount !== null ? money(r.amount, r.currency) : L("bez cene", "no price"),
            paid: r.paid ? L("Da", "Yes") : L("Ne", "No"),
          })),
          foot: { date: L("Ukupno", "Total"), amount: total(sumConv(rows)) },
        },
      ],
    };
  }

  /* --------------------------- other costs ---------------------------- */
  if (p.kind === "expenses") {
    const all = await listExpenses();
    const match = (r: (typeof all)[number]) =>
      (!p.vehicle || r.vehicleId === p.vehicle || r.trailerId === p.vehicle) &&
      (!p.supplier || r.supplierId === p.supplier) &&
      (!p.paid || (p.paid === "paid" ? r.paid : !r.paid));
    const rows = all.filter((r) => inRange(r.date) && match(r)).sort((a, b) => a.date.localeCompare(b.date));
    // what falls on the period: spread / shifted / monthly costs counted in their own months
    const falls = expenseMonthRows(all.filter(match)).filter((s) => inRange(s.date));
    const unpaid = rows.filter((r) => !r.paid);
    const noPrice = rows.filter((r) => r.amount === null).length;
    const byCat = EXPENSE_CATEGORIES.map((c) => ({ c, sum: sumConv(falls.filter((s) => s.category === c.value)) })).filter((x) => x.sum > 0).sort((a, b) => b.sum - a.sum);
    return {
      ...base,
      landscape: true,
      empty: rows.length === 0 && falls.length === 0,
      summary: [
        { label: L("Uneto u periodu", "Entered in period"), value: total(sumConv(rows)), sub: L(`${rows.length} troškova`, `${rows.length} costs`) },
        { label: L("Pada na period", "Falls on period"), value: total(sumConv(falls)), sub: L("sa raspoređenim i mesečnim", "incl. spread and monthly") },
        { label: L("Nije plaćeno", "Unpaid"), value: total(sumConv(unpaid)), sub: unpaid.length ? L(`${unpaid.length} računa`, `${unpaid.length} invoices`) : undefined },
        ...(noPrice ? [{ label: L("Bez cene", "No price"), value: num(noPrice), sub: L("nisu u zbiru", "not in the total") }] : []),
      ],
      tables: [
        {
          columns: [
            { key: "date", label: L("Datum", "Date"), nowrap: true },
            { key: "cat", label: L("Vrsta", "Type") },
            { key: "what", label: L("Opis", "Description") },
            { key: "asset", label: L("Za", "For"), nowrap: true },
            { key: "supplier", label: L("Dobavljač", "Supplier") },
            { key: "invoice", label: L("Račun br.", "Invoice") },
            { key: "how", label: L("Računa se", "Counted") },
            { key: "amount", label: L("Iznos", "Amount"), align: "right", nowrap: true },
            { key: "paid", label: L("Plaćeno", "Paid") },
          ],
          rows: rows.map((r) => ({
            date: date(r.date),
            cat: optLabel(EXPENSE_CATEGORIES, r.category, locale),
            what: r.description ?? "",
            asset: plate.get(r.vehicleId ?? r.trailerId ?? "") ?? L("Firma", "Company"),
            supplier: r.supplierId ? (supplierName.get(r.supplierId) ?? "") : "",
            invoice: r.invoiceNo ?? "",
            how: allocationLabel(r, locale) ?? "",
            amount: r.amount !== null ? money(r.amount, r.currency) : L("bez cene", "no price"),
            paid: r.paid ? L("Da", "Yes") : L("Ne", "No"),
          })),
          foot: { date: L("Ukupno", "Total"), amount: total(sumConv(rows)) },
        },
        ...(byCat.length
          ? [
              {
                title: L("Po vrsti troška (koliko pada na period)", "By type (what falls on the period)"),
                columns: [
                  { key: "cat", label: L("Vrsta", "Type") },
                  { key: "sum", label: L("Iznos", "Amount"), align: "right" as const, nowrap: true },
                ],
                rows: byCat.map((x) => ({ cat: x.c.label[locale], sum: total(x.sum) })),
                foot: { cat: L("Ukupno", "Total"), sum: total(sumConv(falls)) },
              },
            ]
          : []),
      ],
      note: `${base.note} ${L("„Pada na period“ uključuje mesečne troškove i delove troškova raspoređenih na više meseci ili onih koji se računaju od kasnijeg meseca.", "“Falls on period” includes monthly costs and the parts of costs spread over several months or counted from a later month.")}`,
    };
  }

  /* ------------------------- costs per vehicle ------------------------ */
  const showFuel = can(perms, "fuel");
  const showSvc = can(perms, "services");
  const showParts = can(perms, "parts");
  const showExp = can(perms, "expenses");
  const [fuelAll, svcAll, partsAll, expAll] = await Promise.all([showFuel ? listFuel() : [], showSvc ? listServices() : [], showParts ? listParts() : [], showExp ? listExpenses() : []]);
  const exp = expenseMonthRows(expAll).filter((s) => inRange(s.date));
  const fuel = fuelAll.filter((f) => inRange(f.date));
  const svc = svcAll.filter((s) => inRange(s.date));
  const prt = partsAll.filter((s) => inRange(s.date));
  const cons = consumptionByVehicle(fuel);
  const assets = [
    ...vehicles.map((v) => ({ id: v.id, plate: v.plate, model: [v.brand, v.model].filter(Boolean).join(" "), trailer: false })),
    ...trailers.map((t) => ({ id: t.id, plate: t.plate, model: t.brand ?? "", trailer: true })),
  ].filter((a) => !p.vehicle || a.id === p.vehicle);
  const lines = assets
    .map((a) => {
      const f = fuel.filter((x) => x.vehicleId === a.id || x.trailerId === a.id);
      const s = svc.filter((x) => x.vehicleId === a.id || x.trailerId === a.id);
      const pr = prt.filter((x) => x.vehicleId === a.id || x.trailerId === a.id);
      const odo = f.map((x) => x.odometerKm).filter((x): x is number => !!x);
      const km = odo.length > 1 ? Math.max(...odo) - Math.min(...odo) : 0;
      const fc = sumConv(f);
      const sc = sumConv(s);
      const pc = sumConv(pr);
      const oc = sumConv(exp.filter((x) => x.vehicleId === a.id || x.trailerId === a.id));
      return { a, liters: f.reduce((t, x) => t + x.liters, 0), fc, sc, pc, oc, sum: fc + sc + pc + oc, km, l100: (cons[a.id]?.l100 ?? null) as number | null };
    })
    .filter((x) => x.sum > 0 || x.liters > 0)
    .sort((x, y) => y.sum - x.sum);
  // company overhead (not tied to a vehicle) as its own line, so the total is the whole fleet cost
  const overhead = !p.vehicle && showExp ? sumConv(exp.filter((x) => !x.vehicleId && !x.trailerId)) : 0;
  if (overhead > 0)
    lines.push({ a: { id: "_company", plate: L("Firma (opšti troškovi)", "Company (overhead)"), model: "", trailer: false }, liters: 0, fc: 0, sc: 0, pc: 0, oc: overhead, sum: overhead, km: 0, l100: null });
  const tot = lines.reduce((t, x) => ({ liters: t.liters + x.liters, fc: t.fc + x.fc, sc: t.sc + x.sc, pc: t.pc + x.pc, oc: t.oc + x.oc, sum: t.sum + x.sum, km: t.km + x.km }), { liters: 0, fc: 0, sc: 0, pc: 0, oc: 0, sum: 0, km: 0 });
  const columns: Col[] = [
    { key: "plate", label: L("Vozilo", "Vehicle"), nowrap: true },
    { key: "model", label: L("Marka / model", "Make / model") },
    ...(showFuel
      ? [
          { key: "km", label: L("Pređeno km", "Km driven"), align: "right" as const, nowrap: true },
          { key: "liters", label: L("Litara", "Litres"), align: "right" as const, nowrap: true },
          { key: "l100", label: "l/100 km", align: "right" as const, nowrap: true },
          { key: "fc", label: L("Gorivo", "Fuel"), align: "right" as const, nowrap: true },
        ]
      : []),
    ...(showSvc ? [{ key: "sc", label: L("Servisi", "Services"), align: "right" as const, nowrap: true }] : []),
    ...(showParts ? [{ key: "pc", label: L("Delovi", "Parts"), align: "right" as const, nowrap: true }] : []),
    ...(showExp ? [{ key: "oc", label: L("Ostalo", "Other"), align: "right" as const, nowrap: true }] : []),
    { key: "sum", label: L("Ukupno", "Total"), align: "right", nowrap: true },
  ];
  return {
    ...base,
    title: reportTitle("vehicles", locale),
    landscape: true,
    empty: lines.length === 0,
    summary: [
      { label: L("Vozila sa troškovima", "Vehicles with costs"), value: num(lines.filter((x) => x.a.id !== "_company").length) },
      ...(showFuel ? [{ label: L("Gorivo", "Fuel"), value: total(tot.fc), sub: `${num(tot.liters, 2)} l` }] : []),
      ...(showSvc || showParts ? [{ label: L("Servisi i delovi", "Services and parts"), value: total(tot.sc + tot.pc) }] : []),
      ...(showExp ? [{ label: L("Ostali troškovi", "Other costs"), value: total(tot.oc), sub: overhead ? L(`${total(overhead)} na firmu`, `${total(overhead)} company overhead`) : undefined }] : []),
      { label: L("Ukupno", "Total"), value: total(tot.sum) },
    ],
    tables: [
      {
        columns,
        rows: lines.map((x) => ({
          plate: x.a.plate + (x.a.trailer ? ` (${L("prikolica", "trailer")})` : ""),
          model: x.a.model,
          km: x.km ? num(x.km) : "—",
          liters: x.liters ? num(x.liters, 2) : "—",
          l100: x.l100 ? num(x.l100, 1) : "—",
          fc: x.fc ? total(x.fc) : "—",
          sc: x.sc ? total(x.sc) : "—",
          pc: x.pc ? total(x.pc) : "—",
          oc: x.oc ? total(x.oc) : "—",
          sum: total(x.sum),
        })),
        foot: { plate: L("Ukupno", "Total"), km: num(tot.km), liters: num(tot.liters, 2), fc: total(tot.fc), sc: total(tot.sc), pc: total(tot.pc), oc: total(tot.oc), sum: total(tot.sum) },
      },
    ],
    note: `${base.note} ${L("Pređeni km su razlika najveće i najmanje kilometraže sa sipanja u periodu; l/100 km se računa samo iz sipanja do punog rezervoara.", "Km driven is the difference between the highest and lowest odometer on refuels in the period; l/100 km uses full-tank refuels only.")}`,
  };
}
