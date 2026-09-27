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
    odometerKm: integer("odometer_km"),
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
    amount: money("amount").notNull(),
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
    amount: money("amount").notNull(),
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
