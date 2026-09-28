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
  o("other", "Ostalo", "Other"),
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
  o("other", "Ostalo", "Other"),
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
    o("tachograph", "Baždarenje tahografa", "Tachograph calibration"),
    o("cemt", "CEMT dozvola", "CEMT permit"),
    o("license", "Licenca (izvod) za prevoz", "Transport licence copy"),
    o("atp", "ATP sertifikat", "ATP certificate"),
    o("adr", "ADR sertifikat vozila", "ADR vehicle certificate"),
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
    o("adr", "ADR sertifikat", "ADR certificate"),
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

export const PLACE_KINDS: Option[] = [o("shop", "Prodavnica / servis", "Shop / workshop"), o("pump", "Pumpa", "Fuel station")];

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
  driving_license: 3650,
  tachograph_card: 1825,
  cpc: 1825,
  medical: 365,
  adr_card: 1825,
  passport: 3650,
  work_permit: 365,
};

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
