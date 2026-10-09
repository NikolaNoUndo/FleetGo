import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTrack } from "@/lib/telematics";
import { companyRate } from "@/lib/fx";
import { todayISO } from "@/lib/format";
import { countryTiles, tollCountry, TOLL_COUNTRIES } from "./countries";
import { cellsAround } from "./grid";
import { tollParts, tolledKm, totalAxles } from "./calc";
import { fetchTile } from "./overpass";
import type { TollCalc } from "./types";

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
  if (calc.vehicleId !== t.vehicleId || (calc.trailerId ?? null) !== (t.trailerId ?? null)) return true;
  if (Math.abs(Date.parse(calc.from) - localMs(t.dateFrom, t.timeFrom)) > 60_000) return true;
  if (t.dateTo && Math.abs(Date.parse(calc.to) - Math.min(Date.parse(calc.at), localMs(t.dateTo, t.timeTo, true))) > 60_000) return true;
  return false;
}

export type CalcResult = { ok: true; calc: TollCalc } | { ok: false; error: string };

/** Works out a tour's tolls from its truck's track and stores them on the tour. */
export async function calcTourToll(companyId: string, tourId: string): Promise<CalcResult> {
  const [tour] = await db.select().from(schema.tours).where(and(eq(schema.tours.id, tourId), eq(schema.tours.companyId, companyId))).limit(1);
  if (!tour) return { ok: false, error: "Tura ne postoji." };
  if (!tour.vehicleId) return { ok: false, error: "Tura nema kamion." };
  const [[company], [vehicle], trailerRows, network] = await Promise.all([
    db.select().from(schema.companies).where(eq(schema.companies.id, companyId)).limit(1),
    db.select().from(schema.vehicles).where(and(eq(schema.vehicles.id, tour.vehicleId), eq(schema.vehicles.companyId, companyId))).limit(1),
    tour.trailerId ? db.select().from(schema.trailers).where(and(eq(schema.trailers.id, tour.trailerId), eq(schema.trailers.companyId, companyId))).limit(1) : Promise.resolve([]),
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

  // which tolled-network cells are near the track
  const wanted = new Set<number>();
  for (const p of track) for (const c of cellsAround(p.lat, p.lon)) wanted.add(c);
  const hits = new Map<number, string[]>();
  const ids = [...wanted];
  for (let i = 0; i < ids.length; i += 20000) {
    const chunk = ids.slice(i, i + 20000);
    const rows = await db.select({ cell: schema.tollCells.cell, country: schema.tollCells.country }).from(schema.tollCells).where(sql`${schema.tollCells.cell} = any(${`{${chunk.join(",")}}`}::bigint[])`);
    for (const r of rows) hits.set(Number(r.cell), [...(hits.get(Number(r.cell)) ?? []), r.country]);
  }

  const { km, trackKm } = tolledKm(track, (c) => hits.get(c));
  const trailer = (trailerRows as (typeof schema.trailers.$inferSelect)[])[0] ?? null;
  const axles = totalAxles(vehicle, trailer);
  const rate = await companyRate(company);
  const parts = tollParts(km, axles, rate);
  const loaded = new Set(network.filter((n) => n.cells > 0).map((n) => n.country));
  const notes: string[] = [];
  const missing = TOLL_COUNTRIES.filter((c) => !loaded.has(c.code)).map((c) => c.name.sr);
  if (missing.length) notes.push(`Mreža nije učitana za: ${missing.join(", ")}.`);
  if (!vehicle.axles) notes.push(`Broj osovina kamiona nije upisan; računato sa 2${trailer ? ` + ${trailer.axles ?? 3} na prikolici` : ""}.`);
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
    return { code: c.code, ways: r?.ways ?? 0, km: r?.km ?? 0, cells: r?.cells ?? 0, tilesDone: r?.tilesDone ?? 0, tilesTotal: r?.tilesTotal ?? countryTiles(c).length, error: r?.error ?? null, updatedAt: r?.updatedAt?.toISOString() ?? null };
  });
}

/** Starts loading a country again: forgets its old cells. */
export async function resetCountry(code: string) {
  const c = tollCountry(code);
  if (!c) throw new Error("country");
  const total = countryTiles(c).length;
  await db.delete(schema.tollCells).where(eq(schema.tollCells.country, code));
  await db
    .insert(schema.tollNetwork)
    .values({ country: code, ways: 0, km: 0, cells: 0, tilesDone: 0, tilesTotal: total, error: null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.tollNetwork.country, set: { ways: 0, km: 0, cells: 0, tilesDone: 0, tilesTotal: total, error: null, updatedAt: new Date() } });
  return total;
}

/** Loads one tile of a country from OpenStreetMap into the cell table. */
export async function loadTile(code: string, index: number) {
  const c = tollCountry(code);
  if (!c) throw new Error("country");
  const tiles = countryTiles(c);
  if (index < 0 || index >= tiles.length) throw new Error("tile");
  try {
    const { cells, ways, km } = await fetchTile(c, tiles[index]);
    const list = [...cells];
    for (let i = 0; i < list.length; i += 5000) {
      const chunk = list.slice(i, i + 5000);
      await db.execute(sql`insert into toll_cells (cell, country) select unnest(${`{${chunk.join(",")}}`}::bigint[]), ${code} on conflict do nothing`);
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tollCells).where(eq(schema.tollCells.country, code));
    await db
      .update(schema.tollNetwork)
      .set({ ways: sql`${schema.tollNetwork.ways} + ${ways}`, km: sql`${schema.tollNetwork.km} + ${Math.round(km)}`, cells: n, tilesDone: index + 1, error: null, updatedAt: new Date() })
      .where(eq(schema.tollNetwork.country, code));
    return { ways, km: Math.round(km), cells: n, done: index + 1, total: tiles.length };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200);
    await db.update(schema.tollNetwork).set({ error: `Deo ${index + 1}/${tiles.length}: ${msg}`, updatedAt: new Date() }).where(eq(schema.tollNetwork.country, code));
    throw e;
  }
}
