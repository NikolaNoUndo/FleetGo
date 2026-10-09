import "server-only";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTrack } from "@/lib/telematics";
import { companyRate } from "@/lib/fx";
import { todayISO } from "@/lib/format";
import { loadSteps, tollCountry, TOLL_COUNTRIES } from "./countries";
import { byRow, cellsAround, LON_CELLS } from "./grid";
import { tollParts, tolledKm, totalAxles } from "./calc";
import { fetchStep } from "./overpass";
import { RAMP_SYSTEMS, rampTrips } from "./ramps";
import { rampData } from "./ramps-server";
import { RS_SNAPSHOT_DATE } from "./rs-snapshot";
import type { TollCalc, TollPart } from "./types";

const RAMP_COUNTRIES = new Set(RAMP_SYSTEMS.map((s) => s.country));

/** "2026-10-05" + "06:30" in Serbian time → ms since epoch (summer/winter time handled). */
export function localMs(date: string, time: string | null, end = false) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time && /^\d{2}:\d{2}$/.test(time) ? time.split(":").map(Number) : end ? [23, 59] : [0, 0];
  const guess = Date.UTC(y, mo - 1, d, h, mi, end && !time ? 59 : 0);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return guess - (asLocal - guess);
}

/** True when the tour changed after its tolls were worked out (other dates, times or truck). */
export function tollStale(t: { dateFrom: string; timeFrom: string | null; dateTo: string | null; timeTo: string | null; vehicleId: string | null; trailerId: string | null }, calc: TollCalc) {
  // worked out before the country was priced ramp to ramp
  if (calc.parts.some((p) => p.method !== "ramp" && RAMP_COUNTRIES.has(p.country.slice(0, 2)))) return true;
  if (calc.vehicleId !== t.vehicleId || (calc.trailerId ?? null) !== (t.trailerId ?? null)) return true;
  if (Math.abs(Date.parse(calc.from) - localMs(t.dateFrom, t.timeFrom)) > 60_000) return true;
  if (t.dateTo && Math.abs(Date.parse(calc.to) - Math.min(Date.parse(calc.at), localMs(t.dateTo, t.timeTo, true))) > 60_000) return true;
  return false;
}

type Trailer = typeof schema.trailers.$inferSelect;

/**
 * The trailer the truck pulled on this tour: the one on the tour; otherwise the one linked to
 * the truck (several linked: the one it pulled on its last tour, else the one with most axles);
 * a tractor with none known is counted with a 3-axle semi-trailer.
 */
async function tourTrailer(companyId: string, tour: { trailerId: string | null; vehicleId: string | null }, vehicle: { id: string; type: string }): Promise<{ trailer: Pick<Trailer, "plate" | "axles"> | null; how: "tour" | "linked" | "assumed" | null }> {
  const T = schema.trailers;
  if (tour.trailerId) {
    const [t] = await db.select().from(T).where(and(eq(T.id, tour.trailerId), eq(T.companyId, companyId))).limit(1);
    if (t) return { trailer: t, how: "tour" };
  }
  const linked = await db
    .select({ id: T.id, plate: T.plate, axles: T.axles })
    .from(schema.vehicleTrailers)
    .innerJoin(T, eq(T.id, schema.vehicleTrailers.trailerId))
    .where(and(eq(schema.vehicleTrailers.vehicleId, vehicle.id), eq(schema.vehicleTrailers.companyId, companyId), ne(T.status, "inactive")));
  if (linked.length === 1) return { trailer: linked[0], how: "linked" };
  if (linked.length > 1) {
    const [last] = await db
      .select({ trailerId: schema.tours.trailerId })
      .from(schema.tours)
      .where(and(eq(schema.tours.companyId, companyId), eq(schema.tours.vehicleId, vehicle.id), inArray(schema.tours.trailerId, linked.map((l) => l.id))))
      .orderBy(desc(schema.tours.dateFrom))
      .limit(1);
    const pick = linked.find((l) => l.id === last?.trailerId) ?? [...linked].sort((a, b) => (b.axles ?? 3) - (a.axles ?? 3))[0];
    return { trailer: pick, how: "linked" };
  }
  if (vehicle.type === "tractor") return { trailer: { plate: "", axles: 3 }, how: "assumed" };
  return { trailer: null, how: null };
}

/** Which network keys ("RS", "PL-A2"…) each grid cell near the track belongs to. */
async function networkAround(track: { lat: number; lon: number }[]) {
  const wanted = new Set<number>();
  for (const p of track) for (const c of cellsAround(p.lat, p.lon)) wanted.add(c);
  const rowIds = [...byRow(wanted).keys()];
  const hits = new Map<number, string[]>();
  for (let i = 0; i < rowIds.length; i += 5000) {
    const chunk = rowIds.slice(i, i + 5000);
    const rows = await db.select().from(schema.tollRows).where(sql`${schema.tollRows.r} = any(${`{${chunk.join(",")}}`}::int[])`);
    for (const row of rows)
      for (const col of row.cols) {
        const cell = row.r * LON_CELLS + col;
        if (wanted.has(cell)) hits.set(cell, [...(hits.get(cell) ?? []), row.country]);
      }
  }
  return hits;
}

export type CalcResult = { ok: true; calc: TollCalc } | { ok: false; error: string };

/** Works out a tour's tolls from its truck's track and stores them on the tour. */
export async function calcTourToll(companyId: string, tourId: string): Promise<CalcResult> {
  const [tour] = await db.select().from(schema.tours).where(and(eq(schema.tours.id, tourId), eq(schema.tours.companyId, companyId))).limit(1);
  if (!tour) return { ok: false, error: "Tura ne postoji." };
  if (!tour.vehicleId) return { ok: false, error: "Tura nema kamion." };
  const [[company], [vehicle], network] = await Promise.all([
    db.select().from(schema.companies).where(eq(schema.companies.id, companyId)).limit(1),
    db.select().from(schema.vehicles).where(and(eq(schema.vehicles.id, tour.vehicleId), eq(schema.vehicles.companyId, companyId))).limit(1),
    db.select().from(schema.tollNetwork),
  ]);
  if (!vehicle) return { ok: false, error: "Kamion ture ne postoji." };
  if (!company?.wialonToken) return { ok: false, error: "Praćenje (Wialon) nije povezano u Podešavanjima, pa nema trase za računanje. Putarinu možeš da upišeš ručno." };
  if (!network.some((n) => n.cells > 0)) return { ok: false, error: "Mreža puteva pod naplatom još nije učitana (admin panel → Putarina)." };

  const from = localMs(tour.dateFrom, tour.timeFrom);
  const to = Math.min(Date.now(), localMs(tour.dateTo ?? todayISO(), tour.dateTo ? tour.timeTo : null, true));
  if (to <= from) return { ok: false, error: "Vreme povratka je pre vremena polaska." };
  if (to - from > 45 * 86400_000) return { ok: false, error: "Tura je duža od 45 dana; proveri datume." };

  let track;
  try {
    track = await getTrack({ token: company.wialonToken, host: company.wialonHost }, { plate: vehicle.plate, wialonUnitId: vehicle.wialonUnitId }, from, to);
  } catch (e) {
    return { ok: false, error: `Praćenje ne odgovara: ${(e as Error).message}` };
  }
  if (track === null) return { ok: false, error: `Kamion ${vehicle.plate} nije pronađen u praćenju. Upiši Wialon ID ili IMEI na kamionu.` };
  if (track.length < 2) return { ok: false, error: "Praćenje nema zapisa o kretanju za vreme ture." };

  const hits = await networkAround(track);
  const { km, days, seg, trackKm } = tolledKm(track, (c) => hits.get(c));
  const { trailer, how } = await tourTrailer(companyId, tour, vehicle);
  const axles = totalAxles(vehicle, trailer);
  const rate = await companyRate(company);
  const notes: string[] = [];
  // ramp to ramp: priced from the official entry–exit list, the way the operator's calculator
  // does it; such a country is never priced per km
  const rampParts: TollPart[] = [];
  for (const country of [...new Set(Object.keys(km).map((k) => k.slice(0, 2)))]) {
    const systems = await rampData(country);
    if (!systems.length) continue;
    let unpricedKm = 0, unpricedRuns = 0;
    for (const s of systems) {
      const cat = s.system.category(axles);
      const matrix = (s.prices as Record<string, number[][]>)[cat];
      if (!matrix) continue;
      const { trips, unpriced } = rampTrips(track, seg, country, s.stations, s.names, matrix, s.system.passM);
      if (s.system.key === country) {
        unpricedRuns = unpriced.filter((u) => u.km >= 5).length;
        unpricedKm = unpriced.reduce((x, u) => x + u.km, 0);
      }
      if (!trips.length) continue;
      const local = trips.reduce((x, t) => x + t.price, 0);
      rampParts.push({
        country: s.system.key,
        km: Math.round(trips.reduce((x, t) => x + t.km, 0) * 10) / 10,
        eur: Math.round((s.currency === "RSD" ? local / rate : local) * 100) / 100,
        rate: 0,
        rateCurrency: s.currency as TollPart["rateCurrency"],
        method: "ramp",
        trips,
        category: cat,
      });
    }
    for (const k of Object.keys(km)) if (k.slice(0, 2) === country) delete km[k];
    const name = tollCountry(country)?.name.sr;
    if (unpricedRuns > 0) notes.push(`${name}: ${Math.round(unpricedKm)} km autoputa bez prolaska kroz dve naplatne stanice (besplatna deonica ili prekid u praćenju), nije naplaćeno.`);
    if (systems.some((s) => !s.live)) notes.push(`${name}: sajt Puteva Srbije nije odgovorio, korišćen je zvanični cenovnik sačuvan u aplikaciji (${RS_SNAPSHOT_DATE.split("-").reverse().join(". ")}.).`);
  }
  const parts = [
    ...rampParts,
    ...tollParts(km, days, axles, rate, tour.dateFrom).map((p) => ({ ...p, method: p.days ? ("vignette" as const) : ("km" as const), ...(tollCountry(p.country)?.charging === "ramp" ? { estimated: true } : {}) })),
  ];
  const loaded = new Set(network.filter((n) => n.cells > 0).map((n) => n.country));
  const missing = TOLL_COUNTRIES.filter((c) => !loaded.has(c.code)).map((c) => c.name.sr);
  if (missing.length) notes.push(`Mreža nije učitana za: ${missing.join(", ")}.`);
  if (how === "linked") notes.push(`Prikolica nije upisana na turi; uzeta je ${trailer!.plate}, vezana za kamion (${trailer!.axles ?? 3} osovine).`);
  if (how === "assumed") notes.push("Prikolica nije upisana ni vezana za tegljač; računato sa poluprikolicom od 3 osovine.");
  if (!vehicle.axles) notes.push(`Broj osovina kamiona nije upisan; računato sa 2${trailer ? ` + ${trailer.axles ?? 3} na prikolici` : ""}.`);
  if (parts.some((p) => p.days)) notes.push("Rumunija je do 30. 9. 2026. računata kao rovinieta (vinjeta po danima).");
  if (vehicle.euroNorm && !/6|VI/i.test(vehicle.euroNorm)) notes.push(`Cene su za EURO VI; za ${vehicle.euroNorm} je putarina u EU nešto veća.`);

  const calc: TollCalc = {
    at: new Date().toISOString(),
    totalEur: Math.round(parts.reduce((s, p) => s + p.eur, 0) * 100) / 100,
    parts,
    axles,
    euro: vehicle.euroNorm,
    points: track.length,
    trackKm: Math.round(trackKm),
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    vehicleId: vehicle.id,
    trailerId: tour.trailerId,
    ...(notes.length ? { notes } : {}),
  };
  await db.update(schema.tours).set({ tollCalc: calc }).where(and(eq(schema.tours.id, tourId), eq(schema.tours.companyId, companyId)));
  return { ok: true, calc };
}

/* ------------------------------------------------------------------ network (admin) */

export async function networkStatus() {
  const rows = await db.select().from(schema.tollNetwork);
  return TOLL_COUNTRIES.map((c) => {
    const r = rows.find((x) => x.country === c.code);
    return { code: c.code, ways: r?.ways ?? 0, km: r?.km ?? 0, cells: r?.cells ?? 0, tilesDone: r?.tilesDone ?? 0, tilesTotal: r?.tilesTotal ?? loadSteps(c).length, error: r?.error ?? null, updatedAt: r?.updatedAt?.toISOString() ?? null };
  });
}

/** Starts loading a country again: forgets its old network (and its priced stretches). */
export async function resetCountry(code: string) {
  const c = tollCountry(code);
  if (!c || c.code !== code) throw new Error("country");
  const total = loadSteps(c).length;
  await db.delete(schema.tollRows).where(sql`${schema.tollRows.country} = ${code} or ${schema.tollRows.country} like ${code + "-%"}`);
  await db
    .insert(schema.tollNetwork)
    .values({ country: code, ways: 0, km: 0, cells: 0, tilesDone: 0, tilesTotal: total, error: null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.tollNetwork.country, set: { ways: 0, km: 0, cells: 0, tilesDone: 0, tilesTotal: total, error: null, updatedAt: new Date() } });
  return total;
}

/** Loads one step of a country (a tile of its network or a priced stretch) from OpenStreetMap. */
export async function loadTile(code: string, index: number) {
  const c = tollCountry(code);
  if (!c || c.code !== code) throw new Error("country");
  const steps = loadSteps(c);
  if (index < 0 || index >= steps.length) throw new Error("tile");
  const step = steps[index];
  const key = step.kind === "zone" ? step.zone.key : code;
  try {
    const { cells, ways, km } = await fetchStep(c, step);
    const rows = [...byRow(cells)].map(([r, cols]) => ({ r, c: cols }));
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = JSON.stringify(rows.slice(i, i + 2000));
      await db.execute(sql`
        insert into toll_rows (r, country, cols)
        select (x->>'r')::int, ${key}, array(select jsonb_array_elements_text(x->'c')::int)
        from jsonb_array_elements(${chunk}::jsonb) x
        on conflict (r, country) do update set cols = array(select distinct unnest(toll_rows.cols || excluded.cols) order by 1)`);
    }
    const [{ n }] = await db
      .select({ n: sql<number>`coalesce(sum(cardinality(${schema.tollRows.cols})), 0)::int` })
      .from(schema.tollRows)
      .where(sql`${schema.tollRows.country} = ${code} or ${schema.tollRows.country} like ${code + "-%"}`);
    await db
      .update(schema.tollNetwork)
      .set({ ways: sql`${schema.tollNetwork.ways} + ${ways}`, km: step.kind === "tile" ? sql`${schema.tollNetwork.km} + ${Math.round(km)}` : schema.tollNetwork.km, cells: n, tilesDone: index + 1, error: null, updatedAt: new Date() })
      .where(eq(schema.tollNetwork.country, code));
    return { ways, km: Math.round(km), cells: n, done: index + 1, total: steps.length };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200);
    await db.update(schema.tollNetwork).set({ error: `Deo ${index + 1}/${steps.length}: ${msg}`, updatedAt: new Date() }).where(eq(schema.tollNetwork.country, code));
    throw e;
  }
}
