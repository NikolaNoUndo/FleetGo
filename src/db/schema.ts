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
} from "drizzle-orm/pg-core";

/**
 * Multi-tenant from day one: every business table carries company_id.
 * v0.1 runs as the owner of a single company; v0.2 adds users, roles and
 * login (company + username + password) on top of this same shape.
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
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("trailers_company_idx").on(t.companyId)],
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
    workshop: text("workshop"),
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
    supplier: text("supplier"),
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
    amount: money("amount").notNull(),
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
