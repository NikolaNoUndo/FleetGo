import type { OptionSetKey } from "./catalog";
import type { TKey } from "./i18n";
import type { ModuleKey } from "./auth/permissions";

export type ResourceKey = "vehicles" | "trailers" | "employees" | "documents" | "services" | "parts" | "fuel" | "payments" | "suppliers" | "places" | "expenses" | "tours" | "tourLegs" | "clients";
export type RefKey = "vehicles" | "trailers" | "reefers" | "employees" | "drivers" | "suppliers" | "docTypes" | "clients";

export type FieldType = "text" | "int" | "decimal" | "money" | "date" | "select" | "ref" | "textarea" | "bool" | "entity" | "docType" | "supplier" | "drivers" | "links" | "coords" | "month" | "client" | "time";

export type FieldDef = {
  name: string;
  label: TKey;
  type: FieldType;
  required?: boolean;
  options?: OptionSetKey;
  ref?: RefKey;
  span?: 1 | 2;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  /** only shown (and saved) when another field has this value */
  showIf?: { field: string; value: string | string[] };
  /** shown and saved only for members with edit access to this module (e.g. a tour's price) */
  perm?: ModuleKey;
  /** short help under the field */
  hint?: { sr: string; en: string };
};

/** `link`: a record that usually goes with this one (a truck's only trailer), filled in for you */
export type RefOption = { id: string; label: string; sub?: string; link?: string };
export type Refs = Partial<Record<RefKey, RefOption[]>>;

export const RESOURCES: Record<ResourceKey, { title: TKey; fields: FieldDef[]; /** a new record opens its own page (path prefix + id) */ openAfterCreate?: string }> = {
  vehicles: {
    title: "r.vehicles",
    fields: [
      { name: "plate", label: "f.plate", type: "text", required: true, placeholder: "BG 1234-AB" },
      { name: "type", label: "f.type", type: "select", options: "vehicleTypes", required: true, defaultValue: "tractor" },
      { name: "brand", label: "f.brand", type: "text", placeholder: "Scania" },
      { name: "model", label: "f.model", type: "text", placeholder: "R450" },
      { name: "year", label: "f.year", type: "int" },
      { name: "euroNorm", label: "f.euroNorm", type: "select", options: "euroNorms" },
      { name: "axles", label: "f.axles", type: "int", hint: { sr: "Samo vozilo, bez prikolice. Za putarinu.", en: "The vehicle alone, without the trailer. Used for tolls." } },
      { name: "vin", label: "f.vin", type: "text", span: 2 },
      { name: "odometerKm", label: "f.odometerKm", type: "int" },
      { name: "tachoReadAt", label: "f.tachoReadAt", type: "date", showIf: { field: "type", value: ["tractor", "truck"] }, hint: { sr: "Sledeće očitavanje je 90 dana kasnije.", en: "The next download is due 90 days later." } },
      { name: "status", label: "f.status", type: "select", options: "assetStatus", required: true, defaultValue: "active" },
      { name: "driverId", label: "f.mainDriver", type: "drivers", ref: "drivers", span: 2 },
      { name: "trailerIds", label: "f.trailersLinked", type: "links", ref: "trailers", span: 2 },
      { name: "wialonUnitId", label: "f.wialonUnitId", type: "text" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  trailers: {
    title: "r.trailers",
    fields: [
      { name: "plate", label: "f.plate", type: "text", required: true, placeholder: "BG 123-AB" },
      { name: "type", label: "f.type", type: "select", options: "trailerTypes", required: true, defaultValue: "tarpaulin" },
      { name: "brand", label: "f.brand", type: "text", placeholder: "Schmitz Cargobull" },
      { name: "year", label: "f.year", type: "int" },
      { name: "vin", label: "f.vin", type: "text", span: 2 },
      { name: "axles", label: "f.axles", type: "int" },
      { name: "capacityKg", label: "f.capacityKg", type: "int" },
      { name: "status", label: "f.status", type: "select", options: "assetStatus", required: true, defaultValue: "active" },
      { name: "vehicleIds", label: "f.vehiclesLinked", type: "links", ref: "vehicles", span: 2 },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  employees: {
    title: "r.employees",
    fields: [
      { name: "firstName", label: "f.firstName", type: "text", required: true },
      { name: "lastName", label: "f.lastName", type: "text", required: true },
      { name: "role", label: "f.role", type: "select", options: "employeeRoles", required: true, defaultValue: "driver" },
      { name: "status", label: "f.status", type: "select", options: "employeeStatus", required: true, defaultValue: "active" },
      { name: "phone", label: "f.phone", type: "text", placeholder: "+381 6x xxx xxxx" },
      { name: "email", label: "f.email", type: "text" },
      { name: "hiredAt", label: "f.hiredAt", type: "date" },
      { name: "cardReadAt", label: "f.cardReadAt", type: "date", showIf: { field: "role", value: "driver" }, hint: { sr: "Sledeće očitavanje je 28 dana kasnije.", en: "The next download is due 28 days later." } },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  documents: {
    title: "r.documents",
    fields: [
      { name: "entityType", label: "f.entityType", type: "select", options: "entityTypes", required: true, defaultValue: "vehicle" },
      { name: "entityId", label: "f.entity", type: "entity", required: true },
      { name: "docType", label: "f.docType", type: "docType", required: true, span: 2 },
      { name: "number", label: "f.number", type: "text" },
      { name: "issuedAt", label: "f.issuedAt", type: "date" },
      { name: "expiresAt", label: "f.expiresAt", type: "date", required: true },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "RSD" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  services: {
    title: "r.services",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "kind", label: "f.kind", type: "select", options: "serviceKinds", required: true, defaultValue: "regular" },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles" },
      { name: "trailerId", label: "f.trailer", type: "ref", ref: "trailers" },
      { name: "description", label: "f.description", type: "textarea", span: 2 },
      { name: "supplierId", label: "f.workshop", type: "supplier" },
      { name: "odometerKm", label: "f.odometerKm", type: "int" },
      { name: "invoiceNo", label: "f.invoiceNo", type: "text" },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "RSD" },
      { name: "paid", label: "f.paid", type: "bool", defaultValue: true },
    ],
  },
  parts: {
    title: "r.parts",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "name", label: "f.partName", type: "text", required: true },
      { name: "partNumber", label: "f.partNumber", type: "text" },
      { name: "quantity", label: "f.quantity", type: "int", required: true, defaultValue: 1 },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles" },
      { name: "trailerId", label: "f.trailer", type: "ref", ref: "trailers" },
      { name: "supplierId", label: "f.supplier", type: "supplier" },
      { name: "invoiceNo", label: "f.invoiceNo", type: "text" },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "RSD" },
      { name: "paid", label: "f.paid", type: "bool", defaultValue: true },
    ],
  },
  fuel: {
    title: "r.fuel",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles" },
      {
        name: "trailerId",
        label: "f.reefer",
        type: "ref",
        ref: "reefers",
        hint: { sr: "Samo kad je sipano u agregat hladnjače — tada vozilo ostaje prazno.", en: "Only for the reefer unit's own tank — leave the vehicle empty then." },
      },
      { name: "employeeId", label: "f.driver", type: "ref", ref: "drivers" },
      { name: "liters", label: "f.liters", type: "decimal", required: true },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "EUR" },
      { name: "odometerKm", label: "f.odometerKm", type: "int" },
      { name: "station", label: "f.station", type: "text", placeholder: "OMV, MOL, NIS…" },
      { name: "country", label: "f.country", type: "select", options: "countries", defaultValue: "RS" },
      { name: "payment", label: "f.payment", type: "select", options: "fuelPayment", required: true, defaultValue: "card" },
      { name: "fullTank", label: "f.fullTank", type: "bool", defaultValue: true },
    ],
  },
  payments: {
    title: "r.payments",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "employeeId", label: "f.employee", type: "ref", ref: "employees", required: true },
      { name: "kind", label: "f.kind", type: "select", options: "paymentKinds", required: true, defaultValue: "per_diem" },
      { name: "method", label: "f.method", type: "select", options: "paymentMethods", required: true, defaultValue: "cash" },
      { name: "amount", label: "f.amount", type: "money", required: true, defaultValue: "EUR" },
      { name: "note", label: "f.note", type: "textarea", span: 2 },
    ],
  },
  suppliers: {
    title: "r.suppliers",
    fields: [
      { name: "name", label: "f.title", type: "text", required: true, span: 2 },
      { name: "phone", label: "f.phone", type: "text" },
      { name: "note", label: "f.note", type: "text" },
    ],
  },
  expenses: {
    title: "r.expenses",
    fields: [
      { name: "date", label: "f.date", type: "date", required: true },
      { name: "category", label: "f.expenseCategory", type: "select", options: "expenseCategories", required: true, defaultValue: "yard" },
      { name: "description", label: "f.description", type: "text", span: 2, placeholder: "npr. Zakup placa za oktobar" },
      { name: "amount", label: "f.amount", type: "money", defaultValue: "RSD" },
      { name: "paid", label: "f.paid", type: "bool", defaultValue: true },
      {
        name: "vehicleId",
        label: "f.vehicleOptional",
        type: "ref",
        ref: "vehicles",
        hint: { sr: "Samo ako se trošak odnosi na jedno vozilo (npr. kazna). Inače ide na firmu.", en: "Only if it concerns one vehicle (e.g. a fine). Otherwise it goes to the company." },
      },
      { name: "trailerId", label: "f.trailer", type: "ref", ref: "trailers" },
      { name: "supplierId", label: "f.supplier", type: "supplier" },
      { name: "invoiceNo", label: "f.invoiceNo", type: "text" },
      {
        name: "recurring",
        label: "f.recurring",
        type: "bool",
        defaultValue: false,
        span: 2,
        hint: { sr: "Svakog meseca se sam doda isti trošak (zakup, plac, telefoni…).", en: "The same cost is added automatically every month (rent, yard, phones…)." },
      },
      { name: "recurringUntil", label: "f.recurringUntil", type: "date", showIf: { field: "recurring", value: "true" } },
      {
        name: "costFrom",
        label: "f.costFrom",
        type: "month",
        showIf: { field: "recurring", value: "false" },
        hint: { sr: "Ako je kupljeno sada, a koristi se kasnije. Prazno = mesec datuma.", en: "If bought now but used later. Empty = the month of the date." },
      },
      {
        name: "spreadMonths",
        label: "f.spreadMonths",
        type: "int",
        defaultValue: 1,
        showIf: { field: "recurring", value: "false" },
        hint: { sr: "Iznos se deli jednako po mesecima (npr. godišnje osiguranje = 12).", en: "The amount is split evenly across months (e.g. yearly insurance = 12)." },
      },
    ],
  },
  tours: {
    title: "r.tours",
    fields: [
      { name: "dateFrom", label: "f.dateFrom", type: "date", required: true },
      { name: "timeFrom", label: "f.timeFrom", type: "time", hint: { sr: "Za putarinu iz praćenja. Prazno = od početka dana.", en: "For tolls from tracking. Empty = from the start of the day." } },
      {
        name: "dateTo",
        label: "f.dateTo",
        type: "date",
        hint: { sr: "Prazno dok je kamion na putu. Troškovi kamiona i vozača u ovom periodu idu na turu.", en: "Empty while the truck is out. The truck's and driver's costs in this period count for the tour." },
      },
      { name: "timeTo", label: "f.timeTo", type: "time", hint: { sr: "Prazno = do kraja dana.", en: "Empty = until the end of the day." } },
      { name: "vehicleId", label: "f.vehicle", type: "ref", ref: "vehicles", required: true },
      { name: "trailerId", label: "f.trailer", type: "ref", ref: "trailers" },
      { name: "driverId", label: "f.driver", type: "ref", ref: "drivers", span: 2 },
      { name: "distanceKm", label: "f.tourKm", type: "int" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  tourLegs: {
    title: "r.tourLegs",
    fields: [
      { name: "fromPlace", label: "f.fromPlace", type: "text", placeholder: "Čačak" },
      { name: "toPlace", label: "f.toPlace", type: "text", placeholder: "Beograd" },
      { name: "date", label: "f.date", type: "date" },
      { name: "clientId", label: "f.client", type: "client", hint: { sr: "Izaberi ili upiši novog, biće dodat.", en: "Pick one or type a new one; it will be added." } },
      { name: "price", label: "f.legPrice", type: "money", defaultValue: "EUR", perm: "tourPrice" },
      { name: "distanceKm", label: "f.distanceKm", type: "int" },
      { name: "notes", label: "f.notes", type: "textarea", span: 2 },
    ],
  },
  clients: {
    title: "r.clients",
    fields: [
      { name: "name", label: "f.title", type: "text", required: true, span: 2 },
      { name: "phone", label: "f.phone", type: "text" },
      { name: "note", label: "f.note", type: "text" },
    ],
  },
  places: {
    title: "r.places",
    fields: [
      { name: "kind", label: "f.placeKind", type: "select", options: "placeKinds", required: true, defaultValue: "shop" },
      { name: "supplierId", label: "f.chain", type: "supplier" },
      { name: "name", label: "f.placeName", type: "text", span: 2, placeholder: "Auto delovi Novi Sad" },
      { name: "address", label: "f.address", type: "text", span: 2, placeholder: "Sentandrejski put 11, Novi Sad" },
      { name: "phone", label: "f.phone", type: "text", placeholder: "+381 21 …" },
      { name: "coords", label: "f.coords", type: "coords", span: 2, placeholder: "45.2671, 19.8335" },
      { name: "dieselPrice", label: "f.dieselPrice", type: "decimal", placeholder: "1,459", showIf: { field: "kind", value: "pump" } },
      { name: "priceCurrency", label: "f.currency", type: "select", options: "priceCurrencies", defaultValue: "EUR", showIf: { field: "kind", value: "pump" } },
      { name: "note", label: "f.note", type: "text", span: 2 },
    ],
  },
};
