/**
 * Demo data for FleetGo. Run with: npm run db:seed
 * Wipes the demo company (by name) and recreates it, so it is safe to rerun.
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

// deterministic PRNG so the demo looks the same every time
let seed = 42;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;

const today = new Date();
today.setHours(0, 0, 0, 0);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

const COMPANY = "Demo Transport d.o.o.";

async function main() {
  await db.delete(schema.companies).where(eq(schema.companies.name, COMPANY));
  const [company] = await db
    .insert(schema.companies)
    .values({ name: COMPANY, pib: "109876543", address: "Autoput za Novi Sad 12, Beograd", eurRsdRate: 117.2, warnDays: 30 })
    .returning();
  const companyId = company.id;

  // Employees
  const driverNames = [
    ["Marko", "Petrović"], ["Nenad", "Jovanović"], ["Dragan", "Nikolić"], ["Milan", "Ilić"], ["Zoran", "Stojanović"],
    ["Dejan", "Pavlović"], ["Goran", "Marković"], ["Ivan", "Đorđević"], ["Saša", "Kostić"], ["Vladimir", "Todorović"],
    ["Bojan", "Živković"], ["Aleksandar", "Ristić"], ["Miloš", "Savić"], ["Stefan", "Lazić"],
  ];
  const staff = [
    ["Jelena", "Popović", "dispatcher"], ["Ana", "Mitrović", "office"], ["Predrag", "Vasić", "mechanic"], ["Nikola", "Stanković", "manager"],
  ];
  const employees = await db
    .insert(schema.employees)
    .values([
      ...driverNames.map(([f, l], i) => ({
        companyId, firstName: f, lastName: l, role: "driver",
        phone: `+381 6${int(0, 6)} ${int(100, 999)} ${int(1000, 9999)}`,
        email: `${f.toLowerCase()}.${l.toLowerCase().replace(/[ćč]/g, "c").replace(/đ/g, "dj").replace(/š/g, "s").replace(/ž/g, "z")}@demotransport.rs`,
        hiredAt: iso(addDays(-int(200, 3000))),
        status: i === 13 ? "leave" : "active",
      })),
      ...staff.map(([f, l, role]) => ({
        companyId, firstName: f, lastName: l, role, phone: `+381 6${int(0, 6)} ${int(100, 999)} ${int(1000, 9999)}`, hiredAt: iso(addDays(-int(300, 2500))), status: "active",
      })),
    ])
    .returning();
  const drivers = employees.filter((e) => e.role === "driver");

  // Vehicles
  const vdefs: [string, string, string, string, number, string, string][] = [
    ["BG 1742-TK", "tractor", "Scania", "R450", 2021, "EURO 6", "active"],
    ["BG 2281-TK", "tractor", "Volvo", "FH 500", 2022, "EURO 6", "active"],
    ["BG 3390-TK", "tractor", "MAN", "TGX 18.510", 2020, "EURO 6", "active"],
    ["BG 4416-TK", "tractor", "DAF", "XF 480", 2019, "EURO 6", "active"],
    ["NS 5120-TK", "tractor", "Mercedes-Benz", "Actros 1845", 2021, "EURO 6", "active"],
    ["NS 6608-TK", "tractor", "Scania", "S500", 2023, "EURO 6", "active"],
    ["BG 7045-TK", "tractor", "Iveco", "S-Way 490", 2022, "EURO 6", "active"],
    ["BG 8131-TK", "tractor", "Volvo", "FH 460", 2018, "EURO 6", "active"],
    ["BG 9273-TK", "tractor", "Renault", "T 480", 2017, "EURO 6", "in_service"],
    ["NS 1159-TK", "tractor", "DAF", "XF 530", 2023, "EURO 6", "active"],
    ["BG 2604-KM", "truck", "MAN", "TGL 12.250", 2016, "EURO 5", "active"],
    ["BG 3877-KV", "van", "Mercedes-Benz", "Sprinter 317", 2020, "EURO 6", "inactive"],
  ];
  const vehicles = await db
    .insert(schema.vehicles)
    .values(
      vdefs.map(([plate, type, brand, model, year, euro, status], i) => ({
        companyId, plate, type, brand, model, year, euroNorm: euro, status,
        vin: `${brand.slice(0, 2).toUpperCase()}${String(900000 + i * 7331).padStart(6, "0")}${int(10000000, 99999999)}`.slice(0, 17),
        odometerKm: int(180000, 780000) - (year - 2016) * 50000,
        driverId: drivers[i]?.id ?? null,
      })),
    )
    .returning();

  // Trailers
  const tdefs: [string, string, string, number, number, number, string][] = [
    ["BG 101-PR", "tarpaulin", "Schmitz Cargobull", 2020, 3, 24500, "active"],
    ["BG 102-PR", "reefer", "Schmitz Cargobull", 2021, 3, 22000, "active"],
    ["BG 103-PR", "tarpaulin", "Krone", 2019, 3, 24800, "active"],
    ["BG 104-PR", "mega", "Kögel", 2022, 3, 25000, "active"],
    ["NS 105-PR", "reefer", "Krone", 2022, 3, 22300, "active"],
    ["NS 106-PR", "tanker", "Feldbinder", 2018, 3, 25500, "active"],
    ["BG 107-PR", "tarpaulin", "Wielton", 2017, 3, 24000, "active"],
    ["BG 108-PR", "lowbed", "Goldhofer", 2015, 4, 40000, "active"],
    ["BG 109-PR", "tarpaulin", "Schmitz Cargobull", 2023, 3, 25000, "active"],
    ["BG 110-PR", "container", "Krone", 2016, 3, 30000, "active"],
    ["NS 111-PR", "tipper", "Schwarzmüller", 2019, 3, 30000, "in_service"],
    ["BG 112-PR", "reefer", "Chereau", 2020, 3, 21800, "active"],
    ["BG 113-PR", "tarpaulin", "Kögel", 2014, 3, 24000, "inactive"],
  ];
  const trailers = await db
    .insert(schema.trailers)
    .values(
      tdefs.map(([plate, type, brand, year, axles, capacityKg, status], i) => ({
        companyId, plate, type, brand, year, axles, capacityKg, status,
        vin: `WSM${String(100000 + i * 5113)}${int(1000000, 9999999)}`.slice(0, 17),
      })),
    )
    .returning();
  // Trucks and the trailers they use (a trailer may be shared; some have none)
  const links = trailers.flatMap((t, i) => (i < 10 && vehicles[i].type === "tractor" && vehicles[i].status === "active" ? [{ companyId, vehicleId: vehicles[i].id, trailerId: t.id }] : []));
  if (links[0] && trailers[11]) links.push({ companyId, vehicleId: links[0].vehicleId, trailerId: trailers[11].id });
  if (links.length) await db.insert(schema.vehicleTrailers).values(links);

  // Documents with a realistic spread of expiries (some expired, some soon, most fine)
  const docs: (typeof schema.documents.$inferInsert)[] = [];
  const expiry = () => {
    const r = rnd();
    if (r < 0.05) return int(-25, -1);
    if (r < 0.17) return int(0, 30);
    return int(31, 360);
  };
  const addDoc = (entityType: string, entityId: string, docType: string, validDays: number, amount: number | null, currency: string, number?: string) => {
    const exp = expiry();
    docs.push({
      companyId, entityType, entityId, docType, number: number ?? null,
      issuedAt: iso(addDays(exp - validDays)), expiresAt: iso(addDays(exp)), amount, currency,
    });
  };
  for (const v of vehicles) {
    const heavy = v.type === "tractor" || v.type === "truck";
    addDoc("vehicle", v.id, "registration", 365, heavy ? int(160000, 240000) : 38000, "RSD", `RS-${int(100000, 999999)}`);
    addDoc("vehicle", v.id, "technical_inspection", 365, heavy ? 7800 : 4200, "RSD");
    if (heavy) addDoc("vehicle", v.id, "six_month", 182, 5200, "RSD");
    addDoc("vehicle", v.id, "green_card", 365, heavy ? 95 : 40, "EUR", `SRB/${int(10, 99)}/${int(1000000, 9999999)}`);
    if (v.type === "tractor") {
      addDoc("vehicle", v.id, "white_cert", 365, 3500, "RSD");
      addDoc("vehicle", v.id, "tachograph", 730, 110, "EUR");
      addDoc("vehicle", v.id, "license", 365, 2600, "RSD", `L-${int(1000, 9999)}`);
      if (rnd() < 0.5) addDoc("vehicle", v.id, "cemt", 365, 0, "RSD", `CEMT ${int(10000, 99999)}`);
    }
    addDoc("vehicle", v.id, "fire_extinguisher", 365, 3200, "RSD");
    addDoc("vehicle", v.id, "first_aid", 1095, 2100, "RSD");
  }
  for (const t of trailers) {
    addDoc("trailer", t.id, "registration", 365, int(42000, 68000), "RSD", `RS-${int(100000, 999999)}`);
    addDoc("trailer", t.id, "technical_inspection", 365, 5600, "RSD");
    addDoc("trailer", t.id, "six_month", 182, 4100, "RSD");
    addDoc("trailer", t.id, "green_card", 365, 45, "EUR");
    addDoc("trailer", t.id, "fire_extinguisher", 365, 3200, "RSD");
    if (t.type === "reefer") addDoc("trailer", t.id, "atp", 2190, 180, "EUR", `ATP-${int(1000, 9999)}`);
    if (t.type === "tanker") addDoc("trailer", t.id, "adr", 365, 210, "EUR");
  }
  for (const d of drivers) {
    addDoc("employee", d.id, "driving_license", 3650, null, "RSD", `${int(100000000, 999999999)}`);
    addDoc("employee", d.id, "tachograph_card", 1825, 5200, "RSD", `SRB${int(10000000, 99999999)}`);
    addDoc("employee", d.id, "cpc", 1825, 24000, "RSD");
    addDoc("employee", d.id, "medical", 365, 6500, "RSD");
    addDoc("employee", d.id, "passport", 3650, 4500, "RSD");
    if (rnd() < 0.35) addDoc("employee", d.id, "adr_card", 1825, 38000, "RSD");
  }
  await db.insert(schema.documents).values(docs);

  // Fuel: realistic full-tank refuels every few days for active vehicles (12 months back)
  const fuel: (typeof schema.fuelEntries.$inferInsert)[] = [];
  const stations: [string, string, string][] = [
    ["NIS Petrol", "RS", "RSD"], ["OMV", "RS", "RSD"], ["MOL", "HU", "EUR"], ["OMV", "AT", "EUR"], ["Shell", "DE", "EUR"],
    ["Petrol", "SI", "EUR"], ["INA", "HR", "EUR"], ["Lukoil", "BG", "EUR"], ["Eko", "GR", "EUR"], ["MOL", "SK", "EUR"],
  ];
  for (const [i, v] of vehicles.entries()) {
    if (v.status === "inactive") continue;
    const cons = v.type === "van" ? 10 : v.type === "truck" ? 22 : 27 + rnd() * 6; // l/100km
    let odo = (v.odometerKm ?? 400000) - int(115000, 135000);
    let day = -372 + int(0, 3);
    while (day < 0) {
      const liters = v.type === "van" ? round2(55 + rnd() * 20) : round2(380 + rnd() * 260);
      odo += Math.round((liters / cons) * 100 * (0.95 + rnd() * 0.1));
      const [station, country, currency] = pick(stations);
      const pricePerL = currency === "RSD" ? 196 + rnd() * 14 : 1.42 + rnd() * 0.3;
      fuel.push({
        companyId, vehicleId: v.id, employeeId: v.driverId, date: iso(addDays(day)), liters,
        amount: round2(liters * pricePerL), currency, station, country, odometerKm: odo,
        fullTank: true, payment: currency === "RSD" ? pick(["card", "company"]) : pick(["card", "card", "card", "cash"]),
      });
      day += v.type === "van" ? int(5, 9) : int(2, 4);
    }
    await db.update(schema.vehicles).set({ odometerKm: odo + int(50, 400) }).where(eq(schema.vehicles.id, v.id));
    void i;
  }
  await db.insert(schema.fuelEntries).values(fuel);

  // Services
  const workshops = ["Scania Srbija, Beograd", "Volvo Truck Center Novi Sad", "MAN servis Batajnica", "Auto centar Zemun", "Servis Vasić (interno)", "Vulkanizer Petrović"];
  const partSuppliers = ["Auto delovi Vojvodina", "Bosch servis centar", "Kamion delovi Zemun", "Tigar Tyres", "Akumulatori Beograd", "Shell Srbija", "Petrohemija", "Oprema Transport", "Protivpožarna zaštita doo", "Apoteka Zemun", "Cerade Jovanović"];
  const supplierRows = await db
    .insert(schema.suppliers)
    .values([...workshops, ...partSuppliers].map((name) => ({ companyId, name })))
    .returning();
  const supplierId = (name: string) => supplierRows.find((x) => x.name === name)?.id ?? null;
  const svc: (typeof schema.services.$inferInsert)[] = [];
  const serviceTexts: Record<string, string[]> = {
    regular: ["Veliki servis, zamena ulja i filtera", "Mali servis, ulje + filteri", "Redovan servis na 100.000 km"],
    repair: ["Zamena alternatora", "Popravka hladnjaka", "Zamena turbine", "Kvačilo, komplet"],
    tires: ["Zamena prednjih guma", "Rotacija i balansiranje", "Zamena zadnjih guma, 4 kom"],
    brakes: ["Zamena pločica i diskova, prednja osovina", "Servis kočionog sistema"],
    electrical: ["Dijagnostika i popravka instalacije", "Zamena akumulatora"],
    bodywork: ["Popravka branika i farova", "Popravka cerade"],
  };
  for (let k = 0; k < 78; k++) {
    const onTrailer = rnd() < 0.25;
    const v = pick(vehicles.filter((x) => x.status !== "inactive"));
    const t = pick(trailers);
    const kind = pick(["regular", "regular", "repair", "tires", "brakes", "electrical", "bodywork"]);
    const eur = kind === "tires" || rnd() < 0.2;
    const amountRsd = kind === "regular" ? int(35000, 120000) : kind === "repair" ? int(40000, 380000) : int(18000, 160000);
    svc.push({
      companyId, vehicleId: onTrailer ? null : v.id, trailerId: onTrailer ? t.id : null,
      date: iso(addDays(-int(1, 360))), kind: onTrailer && kind === "electrical" ? "bodywork" : kind,
      description: pick(serviceTexts[kind]), odometerKm: onTrailer ? null : (v.odometerKm ?? 0) - int(1000, 60000),
      supplierId: supplierId(pick(workshops)), invoiceNo: `${int(100, 999)}/${today.getFullYear()}`,
      amount: eur ? round2(amountRsd / 117.2) : amountRsd, currency: eur ? "EUR" : "RSD", paid: rnd() > 0.15,
    });
  }
  await db.insert(schema.services).values(svc);

  // Parts & purchases
  const partDefs: [string, string, number, string, string][] = [
    ["Filter ulja", "MANN W 11 102/36", 3900, "RSD", "Auto delovi Vojvodina"],
    ["Filter vazduha", "MANN C 42 1458", 11800, "RSD", "Auto delovi Vojvodina"],
    ["Filter goriva", "Bosch F026402", 5400, "RSD", "Bosch servis centar"],
    ["Kočione pločice (set)", "Textar 29087", 16500, "RSD", "Kamion delovi Zemun"],
    ["Kočioni disk", "Brembo 09.C403", 24000, "RSD", "Kamion delovi Zemun"],
    ["Guma 315/70 R22.5", "Michelin X Multi D", 455, "EUR", "Tigar Tyres"],
    ["Guma 385/65 R22.5", "Continental HT3", 470, "EUR", "Tigar Tyres"],
    ["Akumulator 225Ah", "Varta Promotive", 34000, "RSD", "Akumulatori Beograd"],
    ["Motorno ulje 20 l", "Shell Rimula R6 LME 5W-30", 16800, "RSD", "Shell Srbija"],
    ["AdBlue 1000 l (IBC)", "Greenox", 520, "EUR", "Petrohemija"],
    ["Metlice brisača", "Bosch Eco 700", 2400, "RSD", "Auto delovi Vojvodina"],
    ["LED far", "Hella 1EX 996", 21000, "RSD", "Kamion delovi Zemun"],
    ["Spanjer (kaiš) 50mm", "Dolezych", 1500, "RSD", "Oprema Transport"],
    ["PP aparat 6 kg", "S-6", 4600, "RSD", "Protivpožarna zaštita doo"],
    ["Kutija prve pomoći", "DIN 13164", 2100, "RSD", "Apoteka Zemun"],
    ["Cerada (popravka)", "—", 280, "EUR", "Cerade Jovanović"],
  ];
  const parts: (typeof schema.parts.$inferInsert)[] = [];
  for (let k = 0; k < 88; k++) {
    const [name, partNumber, price, currency, supplier] = pick(partDefs);
    const qty = name.startsWith("Guma") ? pick([2, 2, 4]) : name.startsWith("Spanjer") ? 10 : name.startsWith("Motorno") ? pick([1, 2, 3]) : 1;
    const forTrailer = name.startsWith("Cerada") || (name.startsWith("Guma 385") && rnd() < 0.7) || name.startsWith("Spanjer");
    parts.push({
      companyId, name, partNumber, quantity: qty, supplierId: supplierId(supplier),
      vehicleId: forTrailer ? null : pick(vehicles).id, trailerId: forTrailer ? pick(trailers).id : null,
      date: iso(addDays(-int(1, 360))), invoiceNo: `R-${int(1000, 9999)}`,
      amount: round2(price * qty), currency, paid: rnd() > 0.12,
    });
  }
  await db.insert(schema.parts).values(parts);

  // Driver payments: salary (bank, RSD), per diems (cash, EUR), advances, trip expenses
  const pays: (typeof schema.driverPayments.$inferInsert)[] = [];
  for (let m = 11; m >= 0; m--) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
    for (const d of drivers) {
      const dayOf = (n: number) => {
        const x = new Date(monthStart);
        x.setDate(n);
        return x;
      };
      const fut = (x: Date) => x.getTime() > today.getTime();
      const sal = dayOf(10);
      if (!fut(sal) && m > 0) pays.push({ companyId, employeeId: d.id, date: iso(sal), kind: "salary", amount: int(9, 12) * 10000, currency: "RSD", method: "bank", note: "Plata za prethodni mesec" });
      const pd = dayOf(int(1, 5));
      if (!fut(pd)) pays.push({ companyId, employeeId: d.id, date: iso(pd), kind: "per_diem", amount: 50 * int(16, 23), currency: "EUR", method: "cash", note: "Dnevnice za tekući mesec" });
      if (rnd() < 0.6) {
        const ad = dayOf(int(6, 25));
        if (!fut(ad)) pays.push({ companyId, employeeId: d.id, date: iso(ad), kind: "advance", amount: pick([200, 300, 400, 500]), currency: "EUR", method: "cash", note: "Akontacija za turu" });
      }
      if (rnd() < 0.45) {
        const ex = dayOf(int(8, 27));
        if (!fut(ex)) pays.push({ companyId, employeeId: d.id, date: iso(ex), kind: "expenses", amount: int(40, 260), currency: "EUR", method: "cash", note: pick(["Parking i pranje", "Putarina gotovinom", "Trajekt", "Tehnička roba"]) });
      }
    }
  }
  await db.insert(schema.driverPayments).values(pays);

  console.log(
    `Seeded "${COMPANY}": ${employees.length} employees, ${vehicles.length} vehicles, ${trailers.length} trailers, ${docs.length} documents, ${fuel.length} refuels, ${svc.length} services, ${parts.length} parts, ${pays.length} payments.`,
  );
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
