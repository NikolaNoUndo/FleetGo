export type Locale = "sr" | "en";
export type Currency = "EUR" | "RSD";
export type L = { sr: string; en: string };
export type Option = { value: string; label: L };

const o = (value: string, sr: string, en: string): Option => ({ value, label: { sr, en } });

export const CURRENCIES: Option[] = [o("EUR", "EUR", "EUR"), o("RSD", "RSD", "RSD")];

export const VEHICLE_TYPES: Option[] = [
  o("tractor", "Tegljač", "Tractor unit"),
  o("truck", "Kamion (solo)", "Rigid truck"),
  o("van", "Kombi", "Van"),
  o("car", "Putničko vozilo", "Passenger car"),
];

export const TRAILER_TYPES: Option[] = [
  o("tarpaulin", "Cerada", "Curtainsider"),
  o("reefer", "Hladnjača", "Reefer"),
  o("tanker", "Cisterna", "Tanker"),
  o("lowbed", "Labudica", "Low loader"),
  o("tipper", "Kiper", "Tipper"),
  o("container", "Kontejnerska", "Container chassis"),
  o("mega", "Mega", "Mega trailer"),
];

export const ASSET_STATUS: Option[] = [
  o("active", "Aktivno", "Active"),
  o("in_service", "Na servisu", "In service"),
  o("inactive", "Neaktivno", "Inactive"),
];

export const EMPLOYEE_ROLES: Option[] = [
  o("driver", "Vozač", "Driver"),
  o("mechanic", "Mehaničar", "Mechanic"),
  o("dispatcher", "Dispečer", "Dispatcher"),
  o("office", "Administracija", "Office"),
  o("manager", "Menadžer", "Manager"),
];

export const EMPLOYEE_STATUS: Option[] = [
  o("active", "Aktivan", "Active"),
  o("leave", "Na odsustvu", "On leave"),
  o("inactive", "Ne radi više", "Former"),
];

export const EURO_NORMS: Option[] = ["EURO 3", "EURO 4", "EURO 5", "EEV", "EURO 6"].map((v) => o(v, v, v));

export const SERVICE_KINDS: Option[] = [
  o("regular", "Redovan servis", "Scheduled service"),
  o("repair", "Popravka", "Repair"),
  o("tires", "Gume", "Tyres"),
  o("brakes", "Kočnice", "Brakes"),
  o("bodywork", "Limarija", "Bodywork"),
  o("electrical", "Elektrika", "Electrical"),
  o("other", "Ostali troškovi", "Other costs"),
];

export const FUEL_PAYMENT: Option[] = [
  o("card", "Kartica (DKV/UTA)", "Fuel card (DKV/UTA)"),
  o("cash", "Gotovina", "Cash"),
  o("company", "Račun firme", "Company account"),
];

export const PAYMENT_KINDS: Option[] = [
  o("per_diem", "Dnevnice", "Per diem"),
  o("advance", "Akontacija", "Advance"),
  o("salary", "Plata", "Salary"),
  o("bonus", "Bonus", "Bonus"),
  o("expenses", "Troškovi puta", "Trip expenses"),
  o("other", "Ostali troškovi", "Other costs"),
];

export const PAYMENT_METHODS: Option[] = [
  o("cash", "Gotovina", "Cash"),
  o("bank", "Na račun", "Bank transfer"),
];

export const COUNTRIES: Option[] = [
  o("RS", "Srbija", "Serbia"),
  o("HU", "Mađarska", "Hungary"),
  o("AT", "Austrija", "Austria"),
  o("DE", "Nemačka", "Germany"),
  o("SI", "Slovenija", "Slovenia"),
  o("HR", "Hrvatska", "Croatia"),
  o("BA", "BiH", "Bosnia & Herz."),
  o("ME", "Crna Gora", "Montenegro"),
  o("MK", "S. Makedonija", "N. Macedonia"),
  o("BG", "Bugarska", "Bulgaria"),
  o("RO", "Rumunija", "Romania"),
  o("GR", "Grčka", "Greece"),
  o("IT", "Italija", "Italy"),
  o("SK", "Slovačka", "Slovakia"),
  o("CZ", "Češka", "Czechia"),
  o("PL", "Poljska", "Poland"),
  o("NL", "Holandija", "Netherlands"),
  o("FR", "Francuska", "France"),
  o("OTHER", "Ostalo", "Other"),
];

export type EntityType = "vehicle" | "trailer" | "employee";

export const ENTITY_TYPES: Option[] = [
  o("vehicle", "Vozilo", "Vehicle"),
  o("trailer", "Prikolica", "Trailer"),
  o("employee", "Zaposleni", "Employee"),
];

/** Every document type that has an expiry, grouped by what it belongs to. */
export const DOC_TYPES: Record<EntityType, Option[]> = {
  vehicle: [
    o("registration", "Registracija", "Registration"),
    o("technical_inspection", "Tehnički pregled", "Roadworthiness test"),
    o("six_month", "Šestomesečni pregled", "6-month inspection"),
    o("green_card", "Zeleni karton", "Green card"),
    o("white_cert", "Bela potvrda", "Roadworthiness cert. (white)"),
    o("tachograph", "Sertifikat tahografa (baždarenje)", "Tachograph certificate (calibration)"),
    o("cemt", "CEMT dozvola", "CEMT permit"),
    o("license", "Licenca (izvod) za prevoz", "Transport licence copy"),
    o("atp", "ATP sertifikat", "ATP certificate"),
    o("adr", "ADR sertifikat vozila", "ADR vehicle certificate"),
    o("cmr_insurance", "CMR osiguranje", "CMR insurance"),
    o("tir", "TIR sertifikat (odobrenje vozila)", "TIR approval certificate"),
    o("fire_extinguisher", "PP aparat", "Fire extinguisher"),
    o("first_aid", "Prva pomoć (kutija)", "First aid kit"),
  ],
  trailer: [
    o("registration", "Registracija", "Registration"),
    o("technical_inspection", "Tehnički pregled", "Roadworthiness test"),
    o("six_month", "Šestomesečni pregled", "6-month inspection"),
    o("green_card", "Zeleni karton", "Green card"),
    o("white_cert", "Bela potvrda", "Roadworthiness cert. (white)"),
    o("fire_extinguisher", "PP aparat", "Fire extinguisher"),
    o("atp", "ATP sertifikat", "ATP certificate"),
    o("frc", "FRC sertifikat (frigo)", "FRC certificate (reefer)"),
    o("adr", "ADR sertifikat", "ADR certificate"),
    o("cmr_insurance", "CMR osiguranje", "CMR insurance"),
    o("tir", "TIR sertifikat (odobrenje vozila)", "TIR approval certificate"),
  ],
  employee: [
    o("driving_license", "Vozačka dozvola", "Driving licence"),
    o("tachograph_card", "Kartica za tahograf", "Tachograph card"),
    o("cpc", "CPC / Kod 95", "CPC / Code 95"),
    o("medical", "Lekarsko uverenje", "Medical certificate"),
    o("adr_card", "ADR kartica vozača", "ADR driver card"),
    o("passport", "Pasoš", "Passport"),
    o("work_permit", "Radna dozvola", "Work permit"),
  ],
};

export const ALL_DOC_TYPES: Option[] = (() => {
  const seen = new Map<string, Option>();
  for (const list of Object.values(DOC_TYPES)) for (const x of list) if (!seen.has(x.value)) seen.set(x.value, x);
  return [...seen.values()];
})();

export const PLACE_KINDS: Option[] = [
  o("shop", "Prodavnica delova", "Parts shop"),
  o("service", "Servis", "Workshop"),
  o("pump", "Pumpa", "Fuel station"),
];

/** Kinds of "other costs": company overhead, not fuel/services/parts/driver pay. */
export const EXPENSE_CATEGORIES: Option[] = [
  o("yard", "Plac i parking", "Yard & parking"),
  o("rent", "Zakup", "Rent"),
  o("utilities", "Struja, voda, komunalije", "Utilities"),
  o("insurance", "Osiguranje", "Insurance"),
  o("tolls", "Putarine i vinjete", "Tolls & vignettes"),
  o("documents", "Registracija i dokumenta", "Registration & documents"),
  o("announcements", "Najave", "Pre-notifications"),
  o("fines", "Kazne", "Fines"),
  o("office", "Knjigovodstvo i administracija", "Accounting & admin"),
  o("phone", "Telefoni i internet", "Phones & internet"),
  o("washing", "Pranje vozila", "Vehicle washing"),
  o("equipment", "Oprema i alat", "Equipment & tools"),
  o("supplies", "Potrošni materijal", "Supplies"),
  o("other", "Ostali troškovi", "Other costs"),
];

/** Currencies fuel is priced in along the usual routes. */
export const PRICE_CURRENCIES: Option[] = ["EUR", "RSD", "HUF", "CZK", "PLN", "RON", "BAM", "MKD", "CHF", "GBP", "SEK", "DKK", "NOK", "TRY"].map((c) => o(c, c, c));

export const OPTION_SETS = {
  currencies: CURRENCIES,
  vehicleTypes: VEHICLE_TYPES,
  trailerTypes: TRAILER_TYPES,
  assetStatus: ASSET_STATUS,
  employeeRoles: EMPLOYEE_ROLES,
  employeeStatus: EMPLOYEE_STATUS,
  euroNorms: EURO_NORMS,
  serviceKinds: SERVICE_KINDS,
  fuelPayment: FUEL_PAYMENT,
  paymentKinds: PAYMENT_KINDS,
  paymentMethods: PAYMENT_METHODS,
  countries: COUNTRIES,
  entityTypes: ENTITY_TYPES,
  docTypes: ALL_DOC_TYPES,
  placeKinds: PLACE_KINDS,
  priceCurrencies: PRICE_CURRENCIES,
  expenseCategories: EXPENSE_CATEGORIES,
} as const;
export type OptionSetKey = keyof typeof OPTION_SETS;

export function optLabel(set: Option[], value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  return set.find((x) => x.value === value)?.label[locale] ?? value;
}

/** Typical validity in days, used to suggest the new expiry when adding or renewing a document. */
export const DOC_VALIDITY_DAYS: Record<string, number> = {
  registration: 365,
  technical_inspection: 365,
  six_month: 182,
  green_card: 365,
  white_cert: 365,
  tachograph: 730,
  cemt: 365,
  license: 365,
  atp: 2190,
  adr: 365,
  fire_extinguisher: 365,
  first_aid: 1095,
  cmr_insurance: 365,
  tir: 730,
  frc: 1095,
  driving_license: 3650,
  tachograph_card: 1825,
  cpc: 1825,
  medical: 365,
  adr_card: 1825,
  passport: 3650,
  work_permit: 365,
};

/**
 * Data downloads that repeat: not documents but a date kept on the truck (tachograph)
 * and on the driver (card). "Obnovi" sets it to today; the next one is due a period
 * later (the legal maximum: card 28 days, vehicle unit 90 days). They warn a few days
 * ahead instead of the company's usual window, which would keep a monthly one always "soon".
 */
export const READINGS = {
  tacho_download: { entity: "vehicle", period: 90, warn: 14, label: { sr: "Očitavanje tahografa", en: "Tachograph download" }, every: { sr: "na 3 meseca", en: "every 3 months" } },
  card_download: { entity: "employee", period: 28, warn: 5, label: { sr: "Očitavanje kartice", en: "Driver card download" }, every: { sr: "na 28 dana", en: "every 28 days" } },
} as const;
export type ReadingKind = keyof typeof READINGS;
export const READING_OPTIONS: Option[] = (Object.keys(READINGS) as ReadingKind[]).map((k) => o(k, READINGS[k].label.sr, READINGS[k].label.en));

/** trucks and tractors carry a tachograph; trailers and vans in this app don't */
export const hasTachograph = (v: { type: string; status?: string }) => v.type === "tractor" || v.type === "truck";
export const hasDriverCard = (e: { role: string }) => e.role === "driver";

/** when the next download is due, from the last one */
export const nextReading = (last: string | null | undefined, kind: ReadingKind) => (last ? addDaysISO(last, READINGS[kind].period) : null);

/** How many days before the date something of this kind turns "soon". */
export const warnFor = (docType: string | null | undefined, warnDays: number) => (docType && docType in READINGS ? Math.min(warnDays, READINGS[docType as ReadingKind].warn) : warnDays);

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
