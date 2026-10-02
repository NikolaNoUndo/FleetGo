import {
  ASSET_STATUS,
  DOC_TYPES,
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUS,
  EURO_NORMS,
  TRAILER_TYPES,
  VEHICLE_TYPES,
  type EntityType,
  type L,
  type Option,
} from "../catalog";
import type { ImportSheet } from "./types";

/**
 * What the import workbook holds: one sheet each for trucks, trailers and drivers.
 * Each row is one record; next to its own columns it has one column per document,
 * where only the expiry date is written (that is how fleets keep it in Excel).
 * Headers are matched loosely (case, accents, punctuation and a few common other
 * names), so a company's own spreadsheet mostly works too.
 */

/** lower-case, no accents, only letters/digits/single spaces: "Tehnički pregled*" → "tehnicki pregled" */
export const foldHeader = (s: string) =>
  s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type ColKind = "plate" | "text" | "long" | "int" | "date" | "option" | "name";

export type Col = {
  key: string;
  kind: ColKind;
  label: L;
  aliases?: string[];
  required?: boolean;
  options?: Option[];
  /** other words people use for an option value: folded word → value */
  synonyms?: Record<string, string>;
  /** min / max for numbers */
  range?: [number, number];
  width?: number;
  note?: L;
  /** read from people's own files but not put in the template */
  parseOnly?: boolean;
};

export type DocCol = { key: string; docType: string; label: L; aliases: string[] };

export type SheetSpec = {
  sheet: ImportSheet;
  entity: EntityType;
  module: "vehicles" | "trailers" | "employees";
  title: L;
  group: L;
  names: string[];
  cols: Col[];
  docs: DocCol[];
};

const year = new Date().getFullYear();

const plate: Col = {
  key: "plate",
  kind: "plate",
  label: { sr: "Registracija", en: "Plate" },
  required: true,
  width: 15,
  aliases: ["reg oznaka", "registarska oznaka", "reg broj", "registarski broj", "registarske tablice", "tablice", "tablica", "reg", "plate", "licence plate", "license plate", "plate number", "registration number"],
  note: { sr: "Obavezno. Npr. BG 1234-AB", en: "Required. E.g. BG 1234-AB" },
};
const status = (options: Option[]): Col => ({
  key: "status",
  kind: "option",
  label: { sr: "Status", en: "Status" },
  options,
  width: 14,
  aliases: ["stanje", "status"],
  synonyms: { aktivan: "active", aktivno: "active", aktivna: "active", radi: "active", da: "active", servis: "in_service", "na servisu": "in_service", neaktivan: "inactive", neaktivno: "inactive", prodat: "inactive", prodato: "inactive", "ne radi": "inactive", bolovanje: "leave", odmor: "leave", odsustvo: "leave", "ne radi vise": "inactive", otisao: "inactive" },
  note: { sr: "Prazno = Aktivno", en: "Empty = Active" },
});
const notes: Col = { key: "notes", kind: "long", label: { sr: "Napomena", en: "Notes" }, width: 28, aliases: ["napomene", "beleska", "beleske", "opis", "notes", "note", "comment"] };
const vin: Col = { key: "vin", kind: "text", label: { sr: "VIN (broj šasije)", en: "VIN" }, width: 21, aliases: ["vin", "broj sasije", "sasija", "vin broj", "chassis", "chassis number"] };
const brand: Col = { key: "brand", kind: "text", label: { sr: "Marka", en: "Make" }, width: 14, aliases: ["proizvodjac", "brand", "make", "marka vozila"] };
const yearCol: Col = { key: "year", kind: "int", label: { sr: "Godište", en: "Year" }, width: 9, range: [1950, year + 1], aliases: ["godina", "godina proizvodnje", "god", "year"] };

/** Short names people use for each document column, on top of its label. */
const DOC_ALIASES: Record<string, string[]> = {
  registration: ["registracija do", "istek registracije", "reg do", "registracija vazi do"],
  technical_inspection: ["tehnicki", "tehnicki do", "tehnicki pregled do"],
  six_month: ["sestomesecni", "6 mesecni", "sestomesecni do", "6 mesecni pregled"],
  green_card: ["zeleni karton do", "zeleni"],
  white_cert: ["bela potvrda do"],
  tachograph: ["tahograf", "tahograf do", "bazdarenje", "bazdarenje tahografa", "sertifikat tahografa"],
  cemt: ["cemt", "cemt do"],
  license: ["licenca", "licenca do", "izvod licence"],
  atp: ["atp", "atp do"],
  adr: ["adr", "adr do"],
  cmr_insurance: ["cmr", "cmr do", "cmr polisa"],
  tir: ["tir", "tir do"],
  fire_extinguisher: ["pp aparat do", "protivpozarni aparat"],
  first_aid: ["prva pomoc", "prva pomoc do"],
  frc: ["frc", "frc do"],
  driving_license: ["vozacka", "vozacka do", "vozacka dozvola do"],
  tachograph_card: ["kartica tahografa", "tahograf kartica", "kartica za tahograf do", "kartica tahografa do"],
  cpc: ["kod 95", "code 95", "cpc", "kod 95 do", "cpc do"],
  medical: ["lekarsko", "lekarski", "lekarsko do", "lekarski pregled"],
  adr_card: ["adr kartica", "adr kartica do"],
  passport: ["pasos", "pasos do"],
  work_permit: ["radna dozvola do"],
};

const docCols = (entity: EntityType): DocCol[] =>
  DOC_TYPES[entity].map((d) => ({
    key: `doc:${d.value}`,
    docType: d.value,
    label: { sr: `${d.label.sr} ističe`, en: `${d.label.en} expires` },
    aliases: [
      ...[d.label.sr, d.label.en].flatMap((l) => [`${l} istice`, `${l} do`, `${l} vazi do`, `istek ${l}`, `${l} expires`, `${l} expiry`]),
      // the bare label too, except where it would clash with the plate ("Registracija")
      ...(d.value === "registration" ? [] : [d.label.sr, d.label.en, d.label.sr.replace(/\s*\(.*\)/, "")]),
      ...(DOC_ALIASES[d.value] ?? []),
    ],
  }));

export const SHEETS: SheetSpec[] = [
  {
    sheet: "vehicles",
    entity: "vehicle",
    module: "vehicles",
    title: { sr: "Kamioni", en: "Trucks" },
    group: { sr: "Podaci o vozilu", en: "Vehicle" },
    names: ["kamioni", "kamion", "vozila", "vozilo", "tegljaci", "trucks", "truck", "vehicles"],
    cols: [
      plate,
      { key: "type", kind: "option", label: { sr: "Tip", en: "Type" }, options: VEHICLE_TYPES, width: 16, aliases: ["vrsta", "tip vozila", "vrsta vozila", "type"], synonyms: { tegljac: "tractor", sleper: "tractor", "vucno vozilo": "tractor", kamion: "truck", solo: "truck", kombi: "van", putnicko: "car", automobil: "car", auto: "car" }, note: { sr: "Prazno = Tegljač", en: "Empty = Tractor unit" } },
      brand,
      { key: "model", kind: "text", label: { sr: "Model", en: "Model" }, width: 12, aliases: ["tip modela"] },
      yearCol,
      { key: "euroNorm", kind: "option", label: { sr: "Euro norma", en: "Euro norm" }, options: EURO_NORMS, width: 11, aliases: ["euro", "emisija", "euro norm", "euro klasa"], synonyms: { "3": "EURO 3", "4": "EURO 4", "5": "EURO 5", "6": "EURO 6", "euro3": "EURO 3", "euro4": "EURO 4", "euro5": "EURO 5", "euro6": "EURO 6", "euro 6d": "EURO 6", "euro 6c": "EURO 6" } },
      vin,
      { key: "odometerKm", kind: "int", label: { sr: "Kilometraža", en: "Odometer (km)" }, width: 12, range: [0, 5_000_000], aliases: ["km", "stanje km", "odometar", "predjeni km", "predjena kilometraza", "mileage", "odometer", "kilometraza km"] },
      status(ASSET_STATUS),
      { key: "driver", kind: "text", label: { sr: "Vozač", en: "Driver" }, width: 20, aliases: ["glavni vozac", "vozac ime i prezime", "driver", "vozaci"], note: { sr: "Ime i prezime, kao na listu Vozači", en: "First and last name, as on the Drivers sheet" } },
      { key: "trailers", kind: "text", label: { sr: "Prikolica", en: "Trailer" }, width: 15, aliases: ["prikolice", "poluprikolica", "trailer", "trailers", "registracija prikolice"], note: { sr: "Registracija prikolice; više njih odvoji zarezom", en: "Trailer plate; separate several with commas" } },
      { key: "wialonUnitId", kind: "text", label: { sr: "Wialon ID ili IMEI", en: "Wialon ID or IMEI" }, width: 18, aliases: ["wialon", "wialon id", "imei", "gps", "gps id", "tracker", "unit id"] },
      notes,
    ],
    docs: docCols("vehicle"),
  },
  {
    sheet: "trailers",
    entity: "trailer",
    module: "trailers",
    title: { sr: "Prikolice", en: "Trailers" },
    group: { sr: "Podaci o prikolici", en: "Trailer" },
    names: ["prikolice", "prikolica", "poluprikolice", "trailers", "trailer"],
    cols: [
      plate,
      { key: "type", kind: "option", label: { sr: "Tip", en: "Type" }, options: TRAILER_TYPES, width: 15, aliases: ["vrsta", "tip prikolice", "type"], synonyms: { ceradna: "tarpaulin", tent: "tarpaulin", frigo: "reefer", hladnjaca: "reefer", "frigo prikolica": "reefer", cisterna: "tanker", labudica: "lowbed", kiper: "tipper", kontejnerska: "container", kontejner: "container", mega: "mega" }, note: { sr: "Prazno = Cerada", en: "Empty = Curtainsider" } },
      brand,
      yearCol,
      vin,
      { key: "axles", kind: "int", label: { sr: "Broj osovina", en: "Axles" }, width: 11, range: [1, 10], aliases: ["osovine", "osovina", "axles"] },
      { key: "capacityKg", kind: "int", label: { sr: "Nosivost (kg)", en: "Capacity (kg)" }, width: 13, range: [0, 200_000], aliases: ["nosivost", "nosivost kg", "capacity", "capacity kg"] },
      status(ASSET_STATUS),
      notes,
    ],
    docs: docCols("trailer"),
  },
  {
    sheet: "employees",
    entity: "employee",
    module: "employees",
    title: { sr: "Vozači", en: "Drivers" },
    group: { sr: "Podaci o vozaču", en: "Driver" },
    names: ["vozaci", "vozac", "zaposleni", "radnici", "drivers", "driver", "employees", "staff"],
    cols: [
      { key: "firstName", kind: "name", label: { sr: "Ime", en: "First name" }, required: true, width: 14, aliases: ["first name", "firstname"] },
      { key: "lastName", kind: "name", label: { sr: "Prezime", en: "Last name" }, required: true, width: 16, aliases: ["last name", "lastname", "surname"] },
      { key: "fullName", kind: "name", label: { sr: "Ime i prezime", en: "Full name" }, parseOnly: true, aliases: ["ime prezime", "prezime i ime", "vozac", "zaposleni", "name", "full name", "puno ime", "radnik"] },
      { key: "role", kind: "option", label: { sr: "Uloga", en: "Role" }, options: EMPLOYEE_ROLES, width: 14, aliases: ["pozicija", "radno mesto", "role", "funkcija"], synonyms: { vozac: "driver", mehanicar: "mechanic", dispecer: "dispatcher", administracija: "office", kancelarija: "office", menadzer: "manager" }, note: { sr: "Prazno = Vozač", en: "Empty = Driver" } },
      status(EMPLOYEE_STATUS),
      { key: "phone", kind: "text", label: { sr: "Telefon", en: "Phone" }, width: 16, aliases: ["mobilni", "tel", "broj telefona", "phone", "mobile", "kontakt"] },
      { key: "email", kind: "text", label: { sr: "Email", en: "Email" }, width: 22, aliases: ["e mail", "mejl", "mail", "email adresa"] },
      { key: "hiredAt", kind: "date", label: { sr: "Zaposlen od", en: "Hired on" }, width: 12, aliases: ["datum zaposlenja", "pocetak rada", "zaposlen", "hired", "hired at", "start date"] },
      notes,
    ],
    docs: docCols("employee"),
  },
];

/** Import order: drivers and trailers first, so trucks can link to them. */
export const ORDER: ImportSheet[] = ["employees", "trailers", "vehicles"];

export const specOf = (s: ImportSheet) => SHEETS.find((x) => x.sheet === s)!;

/** header (folded) → column, for one sheet; its own columns win over document columns */
export function headerIndex(spec: SheetSpec): Map<string, Col | DocCol> {
  const m = new Map<string, Col | DocCol>();
  const put = (alias: string, c: Col | DocCol) => {
    const k = foldHeader(alias);
    if (k && !m.has(k)) m.set(k, c);
  };
  for (const c of spec.cols) for (const a of [c.label.sr, c.label.en, c.key, ...(c.aliases ?? [])]) put(a, c);
  for (const d of spec.docs) for (const a of [d.label.sr, d.label.en, d.docType, ...d.aliases]) put(a, d);
  return m;
}

export const isDocCol = (c: Col | DocCol): c is DocCol => c.key.startsWith("doc:");
