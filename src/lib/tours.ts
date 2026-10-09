import "server-only";
import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCompany } from "./tenant";
import { todayISO } from "./format";
import { can, type Perms } from "./auth/permissions";
import { listExpenses, listFuel, listParts, listPayments, listServices } from "./queries";
import { legsRoute } from "./tour-route";

export const listTours = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(schema.tours).where(eq(schema.tours.companyId, id)).orderBy(desc(schema.tours.dateFrom), desc(schema.tours.createdAt));
});

export const listClients = cache(async () => {
  const { id } = await getCompany();
  return db.select().from(schema.clients).where(eq(schema.clients.companyId, id)).orderBy(asc(schema.clients.name));
});

export const listLegs = cache(async () => {
  const { id } = await getCompany();
  const L = schema.tourLegs;
  return db.select().from(L).where(eq(L.companyId, id)).orderBy(asc(L.position), asc(L.createdAt));
});

export type Tour = Awaited<ReturnType<typeof listTours>>[number];
export type Leg = Awaited<ReturnType<typeof listLegs>>[number];

/** legs grouped by tour, in the order they were entered */
export function legsByTour(legs: Leg[]) {
  const m = new Map<string, Leg[]>();
  for (const l of legs) m.set(l.tourId, [...(m.get(l.tourId) ?? []), l]);
  return m;
}

/** Inclusive date window of a tour; a tour still on the road runs until today. */
export const tourWindow = (t: Pick<Tour, "dateFrom" | "dateTo">) => ({ from: t.dateFrom, to: t.dateTo ?? (todayISO() > t.dateFrom ? todayISO() : t.dateFrom) });

export function tourDays(t: Pick<Tour, "dateFrom" | "dateTo">) {
  const w = tourWindow(t);
  return Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000) + 1;
}

type Money = { date: string; amount: number | null; currency: string };
type CostSources = {
  fuel: (Money & { vehicleId: string | null; trailerId: string | null })[];
  services: (Money & { vehicleId: string | null; trailerId: string | null })[];
  parts: (Money & { vehicleId: string | null; trailerId: string | null })[];
  expenses: (Money & { vehicleId: string | null; trailerId: string | null })[];
  payments: (Money & { employeeId: string })[];
};
export type CostKey = keyof CostSources;
export const COST_KEYS: CostKey[] = ["fuel", "payments", "services", "parts", "expenses"];

/**
 * What a tour cost: everything dated inside the tour for its truck (and trailer),
 * plus what its driver was paid in that time (per diem, advances…).
 */
export function tourCosts<S extends CostSources>(t: Pick<Tour, "dateFrom" | "dateTo" | "vehicleId" | "trailerId" | "driverId">, src: S): { [K in CostKey]: S[K] } {
  const w = tourWindow(t);
  const inside = (r: { date: string }) => r.date >= w.from && r.date <= w.to;
  const asset = (r: { vehicleId: string | null; trailerId: string | null }) => (!!t.vehicleId && r.vehicleId === t.vehicleId) || (!!t.trailerId && r.trailerId === t.trailerId);
  return {
    fuel: src.fuel.filter((r) => inside(r) && asset(r)) as S["fuel"],
    services: src.services.filter((r) => inside(r) && asset(r)) as S["services"],
    parts: src.parts.filter((r) => inside(r) && asset(r)) as S["parts"],
    expenses: src.expenses.filter((r) => inside(r) && asset(r)) as S["expenses"],
    payments: src.payments.filter((r) => inside(r) && !!t.driverId && r.employeeId === t.driverId) as S["payments"],
  };
}

/** Other tours of the same truck whose dates overlap: their costs would be counted twice. */
export function overlapping(t: Tour, all: Tour[]) {
  if (!t.vehicleId) return [];
  const w = tourWindow(t);
  return all.filter((o) => o.id !== t.id && o.vehicleId === t.vehicleId && tourWindow(o).from <= w.to && tourWindow(o).to >= w.from);
}

export type LegView = { id: string; fromPlace: string | null; toPlace: string | null; date: string | null; clientId: string | null; distanceKm: number | null; notes: string | null; price?: number | null; currency?: string };

/** a leg as a member may see it: no price without "tourPrice" */
export const legView = (l: Leg, showPrice: boolean): LegView => ({
  id: l.id,
  fromPlace: l.fromPlace,
  toPlace: l.toPlace,
  date: l.date,
  clientId: l.clientId,
  distanceKm: l.distanceKm,
  notes: l.notes,
  ...(showPrice ? { price: l.price, currency: l.currency } : {}),
});

export type TourRow = {
  id: string;
  dateFrom: string;
  dateTo: string | null;
  /** "Čačak → Beograd → Kraljevo → Čačak" from the legs */
  route: string;
  legs: number;
  vehicleId: string | null;
  trailerId: string | null;
  driverId: string | null;
  clientIds: string[];
  distanceKm: number | null;
  notes: string | null;
  days: number;
  /** the legs, for editing; prices only with "tourPrice" */
  legList: LegView[];
  /** sum of the legs' prices in the viewer's display currency; only with "tourPrice" */
  price?: number | null;
  /** only with "profit", in the viewer's display currency */
  costs?: number;
  profit?: number | null;
};

/** A tour's price: its legs' prices added up in one currency (null when none has a price). */
export function tourPrice(legs: Leg[], conv: (amount: number | null | undefined, from: string) => number) {
  const priced = legs.filter((l) => l.price !== null);
  return priced.length ? priced.reduce((s, l) => s + conv(l.price, l.currency), 0) : null;
}

/**
 * A tour's road tolls in the display currency: typed by hand when there is such an
 * amount (from the invoice), otherwise what was worked out from the truck's track.
 */
export function tourToll(t: Pick<Tour, "tollManual" | "tollCurrency" | "tollCalc">, conv: (amount: number | null | undefined, from: string) => number) {
  if (t.tollManual !== null && t.tollManual !== undefined) return { amount: conv(t.tollManual, t.tollCurrency), source: "manual" as const };
  if (t.tollCalc) return { amount: conv(t.tollCalc.totalEur, "EUR"), source: "calc" as const };
  return { amount: 0, source: null };
}

export function tourCostTotal(t: Tour, src: Awaited<ReturnType<typeof allCostSources>>, conv: (amount: number | null | undefined, from: string) => number) {
  const c = tourCosts(t, src);
  return COST_KEYS.reduce((s, k) => s + c[k].reduce((x, r) => x + conv(r.amount, r.currency), 0), 0) + tourToll(t, conv).amount;
}

/**
 * Tours as a member may see them: prices are not sent without "tourPrice", costs and
 * profit not without "profit". Server-side, so nothing hidden ever reaches the browser.
 */
export async function toursFor(perms: Perms, conv: (amount: number | null | undefined, from: string) => number, tours?: Tour[]): Promise<TourRow[]> {
  const [list, legs] = await Promise.all([tours ? Promise.resolve(tours) : listTours(), listLegs()]);
  const byTour = legsByTour(legs);
  const showPrice = can(perms, "tourPrice");
  const showProfit = can(perms, "profit");
  const src = showProfit ? await allCostSources() : null;
  return list.map((t) => {
    const own = byTour.get(t.id) ?? [];
    const row: TourRow = {
      id: t.id,
      dateFrom: t.dateFrom,
      dateTo: t.dateTo,
      route: legsRoute(own),
      legs: own.length,
      legList: own.map((l) => legView(l, showPrice)),
      vehicleId: t.vehicleId,
      trailerId: t.trailerId,
      driverId: t.driverId,
      clientIds: [...new Set(own.map((l) => l.clientId).filter((x): x is string => !!x))],
      distanceKm: t.distanceKm ?? (own.some((l) => l.distanceKm) ? own.reduce((s, l) => s + (l.distanceKm ?? 0), 0) : null),
      notes: t.notes,
      days: tourDays(t),
    };
    const price = tourPrice(own, conv);
    if (showPrice) row.price = price;
    if (src) {
      const costs = tourCostTotal(t, src, conv);
      row.costs = costs;
      row.profit = price === null ? null : price - costs;
    }
    return row;
  });
}

/** Every cost row of the company (for profit, which only owners-level members see). */
export async function allCostSources() {
  const [fuel, services, parts, expenses, payments] = await Promise.all([listFuel(), listServices(), listParts(), listExpenses(), listPayments()]);
  return { fuel, services, parts, expenses, payments };
}

export async function getTour(id: string) {
  const all = await listTours();
  return all.find((t) => t.id === id) ?? null;
}
