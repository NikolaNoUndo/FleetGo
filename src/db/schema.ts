import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
  primaryKey,
  bigint,
  doublePrecision,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Multi-tenant: every business table carries company_id.
 * People sign in with email + password; one email can be a member of several
 * companies, each membership carrying its own role and per-module permissions.
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const companyId = () =>
  uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  pib: text("pib"),
  address: text("address"),
  eurRsdRate: numeric("eur_rsd_rate", { precision: 10, scale: 4, mode: "number" }).notNull().default(117.2),
  warnDays: integer("warn_days").notNull().default(30),
  /** "nbs" = official NBS middle rate, refreshed daily; "manual" = eurRsdRate above */
  rateMode: text("rate_mode").notNull().default("nbs"),
  status: text("status").notNull().default("active"), // active | blocked
  /** Each company's own Wialon access token (server-only, never sent to the browser). */
  wialonToken: text("wialon_token"),
  /** Wialon Local server; null = Wialon Hosting. */
  wialonHost: text("wialon_host"),
  /** head office on the live map */
  hqLat: doublePrecision("hq_lat"),
  hqLng: doublePrecision("hq_lng"),
  /** until when the platform admin may open this company ("Uđi kao"); set by the owner */
  supportAccessUntil: timestamp("support_access_until", { withTimezone: true }),
  createdAt: createdAt(),
});

export const employees = pgTable(
  "employees",
  {
    id: id(),
    companyId: companyId(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: text("role").notNull().default("driver"),
    phone: text("phone"),
    email: text("email"),
    hiredAt: date("hired_at"),
    /** last driver-card download (drivers only); the next one is due 28 days later */
    cardReadAt: date("card_read_at"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("employees_company_idx").on(t.companyId)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: id(),
    companyId: companyId(),
    plate: text("plate").notNull(),
    type: text("type").notNull().default("tractor"),
    brand: text("brand"),
    model: text("model"),
    year: integer("year"),
    vin: text("vin"),
    euroNorm: text("euro_norm"),
    /** axles of the truck itself (without the trailer); used for road tolls */
    axles: integer("axles"),
    odometerKm: integer("odometer_km"),
    /** last tachograph (vehicle unit) download; the next one is due 90 days later */
    tachoReadAt: date("tacho_read_at"),
    status: text("status").notNull().default("active"),
    driverId: uuid("driver_id").references(() => employees.id, { onDelete: "set null" }),
    /** second, third… driver of the same vehicle, in order (the main one is driverId) */
    extraDriverIds: uuid("extra_driver_ids").array().notNull().default(sql`'{}'::uuid[]`),
    wialonUnitId: text("wialon_unit_id"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("vehicles_company_idx").on(t.companyId)],
);

export const trailers = pgTable(
  "trailers",
  {
    id: id(),
    companyId: companyId(),
    plate: text("plate").notNull(),
    type: text("type").notNull().default("tarpaulin"),
    brand: text("brand"),
    year: integer("year"),
    vin: text("vin"),
    axles: integer("axles"),
    capacityKg: integer("capacity_kg"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("trailers_company_idx").on(t.companyId)],
);

/**
 * Which trucks use which trailers. Many-to-many and optional on both sides:
 * a truck can pull several trailers over time, a trailer can be shared.
 */
export const vehicleTrailers = pgTable(
  "vehicle_trailers",
  {
    companyId: companyId(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    trailerId: uuid("trailer_id")
      .notNull()
      .references(() => trailers.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.vehicleId, t.trailerId] }), index("vehicle_trailers_trailer_idx").on(t.trailerId), index("vehicle_trailers_company_idx").on(t.companyId)],
);

/** Expiring documents for vehicles, trailers and employees (polymorphic). */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    companyId: companyId(),
    entityType: text("entity_type").notNull(), // vehicle | trailer | employee
    entityId: uuid("entity_id").notNull(),
    docType: text("doc_type").notNull(),
    number: text("number"),
    issuedAt: date("issued_at"),
    expiresAt: date("expires_at"),
    amount: money("amount"),
    currency: text("currency").notNull().default("RSD"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_company_idx").on(t.companyId),
    index("documents_entity_idx").on(t.entityType, t.entityId),
    index("documents_expires_idx").on(t.expiresAt),
  ],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    companyId: companyId(),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    trailerId: uuid("trailer_id").references(() => trailers.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    kind: text("kind").notNull().default("regular"),
    description: text("description"),
    odometerKm: integer("odometer_km"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    invoiceNo: text("invoice_no"),
    amount: money("amount"),
    currency: text("currency").notNull().default("RSD"),
    paid: boolean("paid").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("services_company_idx").on(t.companyId), index("services_date_idx").on(t.date)],
);

export const parts = pgTable(
  "parts",
  {
    id: id(),
    companyId: companyId(),
    name: text("name").notNull(),
    partNumber: text("part_number"),
    quantity: integer("quantity").notNull().default(1),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    trailerId: uuid("trailer_id").references(() => trailers.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    invoiceNo: text("invoice_no"),
    amount: money("amount"),
    currency: text("currency").notNull().default("RSD"),
    paid: boolean("paid").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("parts_company_idx").on(t.companyId), index("parts_date_idx").on(t.date)],
);

export const fuelEntries = pgTable(
  "fuel_entries",
  {
    id: id(),
    companyId: companyId(),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    /** a reefer trailer's own tank (the cooling unit), instead of a vehicle */
    trailerId: uuid("trailer_id").references(() => trailers.id, { onDelete: "set null" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    liters: numeric("liters", { precision: 10, scale: 2, mode: "number" }).notNull(),
    amount: money("amount"),
    currency: text("currency").notNull().default("EUR"),
    station: text("station"),
    country: text("country"),
    odometerKm: integer("odometer_km"),
    fullTank: boolean("full_tank").notNull().default(true),
    payment: text("payment").notNull().default("card"),
    createdAt: createdAt(),
  },
  (t) => [index("fuel_company_idx").on(t.companyId), index("fuel_date_idx").on(t.date)],
);

export const driverPayments = pgTable(
  "driver_payments",
  {
    id: id(),
    companyId: companyId(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: text("kind").notNull().default("per_diem"),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("EUR"),
    method: text("method").notNull().default("cash"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_company_idx").on(t.companyId), index("payments_date_idx").on(t.date)],
);

/** Suppliers, workshops and vendors – kept per company for picking and filtering. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    companyId: companyId(),
    name: text("name").notNull(),
    phone: text("phone"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("suppliers_company_idx").on(t.companyId), uniqueIndex("suppliers_company_name_uq").on(t.companyId, t.name)],
);

/** Who a tour is driven for. Typed on the tour; a new name is added here on save. */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    companyId: companyId(),
    name: text("name").notNull(),
    phone: text("phone"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("clients_company_idx").on(t.companyId), uniqueIndex("clients_company_name_uq").on(t.companyId, t.name)],
);

/**
 * A tour (tura) is one round of a truck, e.g. Čačak → Beograd → Kraljevo → Čačak, from
 * one date to another. What it earns is on its legs (tourLegs: each load with its own
 * client and price). Its costs are not entered on it: they are the truck's (and its
 * trailer's) fuel, services, parts and other costs, and the driver's payments, dated
 * inside the tour. Prices need the "tourPrice" permission; the profit "profit".
 */
export const tours = pgTable(
  "tours",
  {
    id: id(),
    companyId: companyId(),
    dateFrom: date("date_from").notNull(),
    /** "HH:MM" local time the truck left; empty = start of the day */
    timeFrom: text("time_from"),
    /** null = still on the road */
    dateTo: date("date_to"),
    /** "HH:MM" local time the truck was back; empty = end of the day */
    timeTo: text("time_to"),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    trailerId: uuid("trailer_id").references(() => trailers.id, { onDelete: "set null" }),
    driverId: uuid("driver_id").references(() => employees.id, { onDelete: "set null" }),
    /** kilometres of the whole round */
    distanceKm: integer("distance_km"),
    notes: text("notes"),
    /** road tolls typed by hand; when set it is used instead of the calculated amount */
    tollManual: money("toll_manual"),
    tollCurrency: text("toll_currency").notNull().default("EUR"),
    /** road tolls worked out from the truck's track (see src/lib/tolls) */
    tollCalc: jsonb("toll_calc").$type<import("../lib/tolls/types").TollCalc>(),
    createdAt: createdAt(),
  },
  (t) => [index("tours_company_idx").on(t.companyId), index("tours_vehicle_idx").on(t.vehicleId), index("tours_date_idx").on(t.dateFrom)],
);

/** One leg of a tour (vožnja): a load from one place to another, for a client, at a price. */
export const tourLegs = pgTable(
  "tour_legs",
  {
    id: id(),
    companyId: companyId(),
    tourId: uuid("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    /** order inside the tour, as entered */
    position: integer("position").notNull().default(0),
    fromPlace: text("from_place"),
    toPlace: text("to_place"),
    date: date("date"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    price: money("price"),
    currency: text("currency").notNull().default("EUR"),
    distanceKm: integer("distance_km"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("tour_legs_company_idx").on(t.companyId), index("tour_legs_tour_idx").on(t.tourId), index("tour_legs_client_idx").on(t.clientId)],
);

/**
 * Places shown on the live map: shops/workshops (usually a supplier's branches, e.g.
 * every branch of one supplier) and fuel stations (e.g. the Eurowag network).
 */
export const places = pgTable(
  "places",
  {
    id: id(),
    companyId: companyId(),
    /** "shop" (parts) | "service" (workshop) | "pump" */
    kind: text("kind").notNull().default("shop"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    note: text("note"),
    /** fuel stations: diesel price per litre, its currency and when it was last set */
    dieselPrice: doublePrecision("diesel_price"),
    priceCurrency: text("price_currency"),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("places_company_idx").on(t.companyId, t.kind), index("places_supplier_idx").on(t.supplierId)],
);

/* ------------------------------------------------------------------ */
/* Auth & access                                                       */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(), // stored lower-case
    name: text("name"),
    passwordHash: text("password_hash"), // null until the person sets a password
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    status: text("status").notNull().default("active"), // active | blocked
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: companyId(),
    role: text("role").notNull().default("dispatcher"), // owner | dispatcher | service | accounting (driver later)
    permissions: jsonb("permissions").$type<Record<string, "none" | "view" | "edit">>().notNull().default({}),
    /** future: a driver login is tied to an employee record */
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"), // active | disabled
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_user_company_uq").on(t.userId, t.companyId), index("memberships_company_idx").on(t.companyId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    kind: text("kind").notNull().default("user"), // user | admin
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    impersonatedBy: text("impersonated_by"), // "admin" when the developer is viewing as this user
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** browser / device the session was started from (shown under Profile → active sessions) */
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One-time links for setting / resetting a password. */
export const authTokens = pgTable("auth_tokens", {
  id: text("id").primaryKey(), // sha256 of the token in the link
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull().default("set_password"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const registrationRequests = pgTable("registration_requests", {
  id: id(),
  companyName: text("company_name").notNull(),
  pib: text("pib"),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  fleetSize: text("fleet_size"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actor: text("actor").notNull(), // "admin" or the user's email
    companyId: uuid("company_id"),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_company_idx").on(t.companyId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(), // email or "admin"
    ok: boolean("ok").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

/** Official NBS middle rate, one row per day. */
export const fxRates = pgTable(
  "fx_rates",
  {
    day: date("day").notNull(),
    currency: text("currency").notNull().default("EUR"),
    rate: numeric("rate", { precision: 10, scale: 4, mode: "number" }).notNull(),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.currency] })],
);

/**
 * Costs of the company that are not fuel, services, parts or driver pay: the yard,
 * rent, utilities, insurance, tolls, fines, office… Optionally tied to one vehicle.
 * A cost can count from a later month and be spread over several months, and a
 * monthly one is a template that gets a copy every month.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    companyId: companyId(),
    date: date("date").notNull(),
    category: text("category").notNull().default("other"),
    description: text("description"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    trailerId: uuid("trailer_id").references(() => trailers.id, { onDelete: "set null" }),
    invoiceNo: text("invoice_no"),
    amount: money("amount"),
    currency: text("currency").notNull().default("RSD"),
    paid: boolean("paid").notNull().default(true),
    /** first month the cost counts in; empty = the month of `date` */
    costFrom: date("cost_from"),
    /** spread the amount evenly over this many months */
    spreadMonths: integer("spread_months").notNull().default(1),
    /** monthly: this row is the template and gets a copy every month */
    recurring: boolean("recurring").notNull().default(false),
    recurringUntil: date("recurring_until"),
    /** date of the next copy to create */
    recurringNext: date("recurring_next"),
    /** copies point to their template */
    parentId: uuid("parent_id").references((): AnyPgColumn => expenses.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_company_idx").on(t.companyId), index("expenses_date_idx").on(t.date), index("expenses_recurring_idx").on(t.companyId, t.recurring)],
);

/**
 * What users tell us from inside the app ("Pošalji utisak"). Read only in the admin
 * panel; company and user names are kept as they were, so the note stays readable
 * even if the company or user is removed.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    companyName: text("company_name"),
    userEmail: text("user_email"),
    message: text("message").notNull(),
    /** the page it was sent from */
    page: text("page"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_created_idx").on(t.createdAt), index("feedback_user_idx").on(t.userId)],
);

/**
 * The admin's own notes: what changed on which day ("change") and ideas for later
 * ("idea"). Typed in the admin panel, or shipped with the code (src/content/notes.ts,
 * with a key) and copied in once; a removed one with a key stays as a tombstone so it
 * isn't copied in again.
 */
export const adminNotes = pgTable(
  "admin_notes",
  {
    id: id(),
    kind: text("kind").notNull(), // change | idea
    date: date("date"),
    text: text("text").notNull(),
    source: text("source").notNull().default("manual"), // manual | claude
    key: text("key"),
    done: boolean("done").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("admin_notes_key_uq").on(t.key), index("admin_notes_kind_idx").on(t.kind, t.date)],
);

/**
 * Tolled road network from OpenStreetMap, as a grid of 0.001° cells (~110 × 80 m), kept
 * compact: one row per network key ("RS", "PL-A2"…) and grid row, holding the grid columns
 * the roads run through. Shared by all companies; refreshed from the admin panel.
 */
export const tollRows = pgTable(
  "toll_rows",
  {
    r: integer("r").notNull(),
    country: text("country").notNull(),
    cols: integer("cols").array().notNull(),
  },
  (t) => [primaryKey({ columns: [t.r, t.country] })],
);

/** When each country's tolled network was last loaded, and how big it is. */
export const tollNetwork = pgTable("toll_network", {
  country: text("country").primaryKey(),
  ways: integer("ways").notNull().default(0),
  km: integer("km").notNull().default(0),
  cells: integer("cells").notNull().default(0),
  tilesDone: integer("tiles_done").notNull().default(0),
  tilesTotal: integer("tiles_total").notNull().default(0),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
