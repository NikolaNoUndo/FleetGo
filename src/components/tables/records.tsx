"use client";

import { RefreshCw, Truck, Container, User, Wrench, Package, Fuel, Wallet } from "lucide-react";
import Link from "@/components/ui/link";
import { useState } from "react";
import { DataTable, IconTile, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { ExpiryBadge, Select } from "../ui/client";
import { Badge } from "../ui/primitives";
import { RenewDialog } from "../renew-dialog";
import { AddButton, Amount, PaidBadge, PeriodSelect, Stack, TotalRow, usePeriod } from "./common";
import { COUNTRIES, DOC_TYPES, ENTITY_TYPES, FUEL_PAYMENT, PAYMENT_KINDS, PAYMENT_METHODS, SERVICE_KINDS, type EntityType } from "@/lib/catalog";
import { expiryState } from "@/lib/format";
import type { Refs } from "@/lib/resources";

type Common = { refs: Refs; names: Record<string, string>; fixed?: Record<string, string>; hide?: string[]; flush?: boolean };
/** Amount, or a "no price yet" marker so entries saved without a price are easy to spot and fill in. */
export function OptionalAmount({ amount, currency }: { amount: number | null; currency: string }) {
  const { locale } = usePrefs();
  if (amount !== null) return <Amount amount={amount} currency={currency} />;
  return <Badge tone="warn">{locale === "sr" ? "Bez cene" : "No price"}</Badge>;
}

const keep = <T,>(cols: Column<T>[], hide?: string[]) => (hide?.length ? cols.filter((c) => !hide.includes(c.key)) : cols);

/* ------------------------------ Documents ------------------------------ */
export type DocRow = {
  id: string;
  entityType: string;
  entityId: string;
  docType: string;
  number: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  amount: number | null;
  currency: string;
  notes: string | null;
  ownerName: string;
};

const entityHref = (r: { entityType: string; entityId: string }) =>
  `/${r.entityType === "vehicle" ? "vehicles" : r.entityType === "trailer" ? "trailers" : "employees"}/${r.entityId}`;

export function DocumentsTable({ rows, refs, fixed, hide, flush, initialFilter }: Omit<Common, "names"> & { rows: DocRow[]; initialFilter?: string }) {
  const { t, opt, date, warnDays, locale } = usePrefs();
  const crud = useCrud("documents", refs, fixed);
  const [entity, setEntity] = useState<"all" | EntityType>("all");
  const shown = entity === "all" ? rows : rows.filter((r) => r.entityType === entity);
  const Icon = { vehicle: Truck, trailer: Container, employee: User } as const;

  // "Obnovi" opens its own dialog: how long, from when, new number and price
  const [renewing, setRenewing] = useState<DocRow | null>(null);
  const renew = (r: DocRow) => setRenewing(r);

  const cols: Column<DocRow>[] = [
    {
      key: "doc", m: "title",
      header: t("f.docType"),
      sortValue: (r) => opt(DOC_TYPES[r.entityType as EntityType] ?? [], r.docType),
      render: (r) => <Stack main={opt(DOC_TYPES[r.entityType as EntityType] ?? [], r.docType)} sub={r.number} />,
    },
    {
      key: "owner", m: "sub",
      header: t("f.entityType"),
      sortValue: (r) => r.ownerName,
      render: (r) => {
        const I = Icon[r.entityType as EntityType] ?? Truck;
        return (
          <Link href={entityHref(r)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 text-ink-2 hover:text-accent">
            <I className="text-ink-3" />
            <span className="font-medium">{r.ownerName}</span>
          </Link>
        );
      },
    },
    { key: "issued", m: "hide", header: t("f.issuedAt"), sortValue: (r) => r.issuedAt, hide: "lg", render: (r) => <span className="text-ink-2 tnum">{date(r.issuedAt)}</span> },
    { key: "expires", m: "sub", header: t("f.expiresAt"), sortValue: (r) => r.expiresAt, render: (r) => <span className="font-medium tnum">{date(r.expiresAt)}</span> },
    { key: "state", m: "end", header: t("f.status"), sortValue: (r) => r.expiresAt, render: (r) => <ExpiryBadge date={r.expiresAt} compact /> },
    { key: "amount", m: "end2", header: t("f.amount"), align: "right", hide: "md", sortValue: (r) => r.amount, render: (r) => (r.amount ? <Amount amount={r.amount} currency={r.currency} /> : <span className="text-ink-4">—</span>) },
  ];

  return (
    <>
      <DataTable
        flush={flush}
        key={initialFilter}
        rows={shown}
        columns={keep(cols, hide)}
        searchText={(r) => [opt(DOC_TYPES[r.entityType as EntityType] ?? [], r.docType), r.ownerName, r.number].join(" ")}
        filters={[
          ...(initialFilter === "attention"
            ? [{ value: "attention", label: locale === "sr" ? "Zahteva pažnju" : "Needs attention", predicate: (r: DocRow) => ["expired", "soon"].includes(expiryState(r.expiresAt, warnDays)) }]
            : []),
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "expired", label: t("e.expired"), predicate: (r) => expiryState(r.expiresAt, warnDays) === "expired" },
          { value: "soon", label: t("e.soon"), predicate: (r) => expiryState(r.expiresAt, warnDays) === "soon" },
          { value: "ok", label: t("e.ok"), predicate: (r) => expiryState(r.expiresAt, warnDays) === "ok" },
        ]}
        toolbar={
          <>
            {!fixed && (
              <div className="min-w-[40%] flex-1 sm:w-40 sm:min-w-0 sm:flex-none">
                <Select value={entity} onChange={(e) => setEntity(e.target.value as typeof entity)} className="sm:h-9">
                  <option value="all">{t("c.all")}</option>
                  {ENTITY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label[locale]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {crud.canEdit && <AddButton onClick={crud.create} quick={!fixed} />}
          </>
        }
        actions={crud.canEdit ? (r) => crud.menu(r, [{ label: t("c.renew"), icon: <RefreshCw />, onSelect: () => renew(r) }]) : undefined}
        initialSort={{ key: "expires", dir: "asc" }}
        mIcon={(r) => {
          const I = Icon[r.entityType as EntityType] ?? Truck;
          return (
            <IconTile>
              <I />
            </IconTile>
          );
        }}
      />
      {crud.node}
      <RenewDialog doc={renewing} onClose={() => setRenewing(null)} />
    </>
  );
}

/* ------------------------------ Services ------------------------------ */
export type ServiceRow = {
  id: string;
  vehicleId: string | null;
  trailerId: string | null;
  date: string;
  kind: string;
  description: string | null;
  odometerKm: number | null;
  supplierId: string | null;
  invoiceNo: string | null;
  /** can be left empty and filled in later */
  amount: number | null;
  currency: string;
  paid: boolean;
};

export function ServicesTable({ rows, refs, names, fixed, hide, flush }: Common & { rows: ServiceRow[] }) {
  const { t, opt, date, conv, locale } = usePrefs();
  const crud = useCrud("services", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const [sup, setSup] = useState("all");
  const shown = sup === "all" ? filtered : filtered.filter((r) => r.supplierId === sup);
  const supplierIds = [...new Set(rows.map((r) => r.supplierId).filter(Boolean))] as string[];
  const cols = keep<ServiceRow>(
    [
      { key: "date", m: "hide", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "for", m: "sub", header: t("f.for"), sortValue: (r) => names[r.vehicleId ?? r.trailerId ?? ""] ?? "", render: (r) => <span className="font-medium">{names[r.vehicleId ?? r.trailerId ?? ""] ?? "—"}</span> },
      { key: "kind", m: "title", header: t("f.kind"), sortValue: (r) => r.kind, render: (r) => <Stack main={opt(SERVICE_KINDS, r.kind)} sub={r.description} /> },
      { key: "workshop", m: "sub", header: t("f.workshop"), sortValue: (r) => names[r.supplierId ?? ""] ?? "", hide: "lg", render: (r) => <span className="text-ink-2">{names[r.supplierId ?? ""] ?? "—"}</span> },
      { key: "amount", m: "end", header: t("f.amount"), align: "right", sortValue: (r) => (r.amount === null ? -1 : conv(r.amount, r.currency)), render: (r) => <OptionalAmount amount={r.amount} currency={r.currency} /> },
      { key: "paid", m: "end2", header: t("f.paid"), sortValue: (r) => Number(r.paid), hide: "sm", render: (r) => <PaidBadge paid={r.paid} /> },
    ],
    hide,
  );
  const amountIdx = cols.findIndex((c) => c.key === "amount");
  return (
    <>
      <DataTable
        flush={flush}
        rows={shown}
        columns={cols}
        searchText={(r) => [names[r.vehicleId ?? ""], names[r.trailerId ?? ""], r.description, names[r.supplierId ?? ""], r.invoiceNo, opt(SERVICE_KINDS, r.kind)].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "unpaid", label: t("c.unpaid"), predicate: (r) => !r.paid },
          { value: "noPrice", label: locale === "sr" ? "Bez cene" : "No price", predicate: (r) => r.amount === null },
        ]}
        toolbar={
          <>
            {supplierIds.length > 0 && (
              <div className="w-full sm:w-48">
                <Select value={sup} onChange={(e) => setSup(e.target.value)} aria-label={t("f.supplier")}>
                  <option value="all">{locale === "sr" ? "Svi dobavljači" : "All suppliers"}</option>
                  {supplierIds
                    .map((id) => ({ id, name: names[id] ?? "—" }))
                    .sort((x, y) => x.name.localeCompare(y.name))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </Select>
              </div>
            )}
            <PeriodSelect value={period} onChange={setPeriod} />
            {crud.canEdit && <AddButton onClick={crud.create} quick={!fixed} />}
          </>
        }
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: "date", dir: "desc" }}
        mIcon={() => (
          <IconTile>
            <Wrench />
          </IconTile>
        )}
        mGroup={(r) => date(r.date)}
        footer={(v) => <TotalRow colSpan={cols.length} before={amountIdx} total={v.reduce((s, r) => s + conv(r.amount, r.currency), 0)} after={cols.length - amountIdx} />}
      />
      {crud.node}
    </>
  );
}

/* ------------------------------ Parts ------------------------------ */
export type PartRow = {
  id: string;
  name: string;
  partNumber: string | null;
  quantity: number;
  supplierId: string | null;
  vehicleId: string | null;
  trailerId: string | null;
  date: string;
  invoiceNo: string | null;
  /** can be left empty and filled in later */
  amount: number | null;
  currency: string;
  paid: boolean;
};

export function PartsTable({ rows, refs, names, fixed, hide, flush }: Common & { rows: PartRow[] }) {
  const { t, date, conv, num, locale } = usePrefs();
  const crud = useCrud("parts", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const [sup, setSup] = useState("all");
  const shown = sup === "all" ? filtered : filtered.filter((r) => r.supplierId === sup);
  const supplierIds = [...new Set(rows.map((r) => r.supplierId).filter(Boolean))] as string[];
  const cols = keep<PartRow>(
    [
      { key: "date", m: "hide", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "name", m: "title", header: t("f.partName"), sortValue: (r) => r.name, render: (r) => <Stack main={r.name} sub={r.partNumber} /> },
      { key: "qty", m: "hide", header: t("f.quantity"), align: "right", sortValue: (r) => r.quantity, hide: "sm", render: (r) => <span className="text-ink-2">{num(r.quantity)}</span> },
      { key: "for", m: "sub", header: t("f.for"), sortValue: (r) => names[r.vehicleId ?? r.trailerId ?? ""] ?? "", render: (r) => <span className="font-medium">{names[r.vehicleId ?? r.trailerId ?? ""] ?? "—"}</span> },
      { key: "supplier", m: "hide", header: t("f.supplier"), sortValue: (r) => names[r.supplierId ?? ""] ?? "", hide: "lg", render: (r) => <span className="text-ink-2">{names[r.supplierId ?? ""] ?? "—"}</span> },
      { key: "amount", m: "end", header: t("f.amount"), align: "right", sortValue: (r) => (r.amount === null ? -1 : conv(r.amount, r.currency)), render: (r) => <OptionalAmount amount={r.amount} currency={r.currency} /> },
      { key: "paid", m: "end2", header: t("f.paid"), sortValue: (r) => Number(r.paid), hide: "sm", render: (r) => <PaidBadge paid={r.paid} /> },
    ],
    hide,
  );
  const amountIdx = cols.findIndex((c) => c.key === "amount");
  return (
    <>
      <DataTable
        flush={flush}
        rows={shown}
        columns={cols}
        searchText={(r) => [r.name, r.partNumber, names[r.supplierId ?? ""], r.invoiceNo, names[r.vehicleId ?? ""], names[r.trailerId ?? ""]].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "unpaid", label: t("c.unpaid"), predicate: (r) => !r.paid },
          { value: "noPrice", label: locale === "sr" ? "Bez cene" : "No price", predicate: (r) => r.amount === null },
        ]}
        toolbar={
          <>
            {supplierIds.length > 0 && (
              <div className="w-full sm:w-48">
                <Select value={sup} onChange={(e) => setSup(e.target.value)} aria-label={t("f.supplier")}>
                  <option value="all">{locale === "sr" ? "Svi dobavljači" : "All suppliers"}</option>
                  {supplierIds
                    .map((id) => ({ id, name: names[id] ?? "—" }))
                    .sort((x, y) => x.name.localeCompare(y.name))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </Select>
              </div>
            )}
            <PeriodSelect value={period} onChange={setPeriod} />
            {crud.canEdit && <AddButton onClick={crud.create} quick={!fixed} />}
          </>
        }
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: "date", dir: "desc" }}
        mIcon={() => (
          <IconTile>
            <Package />
          </IconTile>
        )}
        mGroup={(r) => date(r.date)}
        footer={(v) => <TotalRow colSpan={cols.length} before={amountIdx} total={v.reduce((s, r) => s + conv(r.amount, r.currency), 0)} after={cols.length - amountIdx} />}
      />
      {crud.node}
    </>
  );
}

/* ------------------------------ Fuel ------------------------------ */
export type FuelRow = {
  id: string;
  vehicleId: string | null;
  employeeId: string | null;
  date: string;
  liters: number;
  amount: number | null;
  currency: string;
  station: string | null;
  country: string | null;
  odometerKm: number | null;
  fullTank: boolean;
  payment: string;
};

export function FuelTable({ rows, refs, names, fixed, hide, flush }: Common & { rows: FuelRow[] }) {
  const { t, date, conv, num, money, opt } = usePrefs();
  const crud = useCrud("fuel", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const cols = keep<FuelRow>(
    [
      { key: "date", m: "hide", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "vehicle", m: "title", header: t("f.vehicle"), sortValue: (r) => names[r.vehicleId ?? ""] ?? "", render: (r) => <span className="font-medium">{names[r.vehicleId ?? ""] ?? "—"}</span> },
      { key: "driver", m: "sub", header: t("f.driver"), sortValue: (r) => names[r.employeeId ?? ""] ?? "", hide: "md", render: (r) => <span className="text-ink-2">{names[r.employeeId ?? ""] ?? "—"}</span> },
      { key: "station", m: "hide", header: t("f.station"), sortValue: (r) => r.country, hide: "lg", render: (r) => <Stack main={<span className="font-normal text-ink-2">{r.station ?? "—"}</span>} sub={opt(COUNTRIES, r.country)} /> },
      { key: "liters", m: "sub", header: t("f.liters"), align: "right", sortValue: (r) => r.liters, render: (r) => <span className="text-ink-2">{num(r.liters, 1)} l</span> },
      { key: "ppl", m: "end2", header: t("f.pricePerL"), align: "right", hide: "sm", sortValue: (r) => (r.amount ? conv(r.amount / r.liters, r.currency) : null), render: (r) => <span className="text-ink-3">{r.amount ? money(r.amount / r.liters, r.currency === "RSD" ? "RSD" : "EUR") : "—"}</span> },
      { key: "amount", m: "end", header: t("f.amount"), align: "right", sortValue: (r) => conv(r.amount, r.currency), render: (r) => <Amount amount={r.amount} currency={r.currency} /> },
      { key: "km", m: "hide", header: t("f.odometerKm"), align: "right", hide: "lg", sortValue: (r) => r.odometerKm, render: (r) => <span className="text-ink-3">{r.odometerKm ? num(r.odometerKm) : "—"}</span> },
    ],
    hide,
  );
  const amountIdx = cols.findIndex((c) => c.key === "amount");
  const pay = (r: FuelRow) => opt(FUEL_PAYMENT, r.payment);
  return (
    <>
      <DataTable
        flush={flush}
        rows={filtered}
        columns={cols}
        searchText={(r) => [names[r.vehicleId ?? ""], names[r.employeeId ?? ""], r.station, opt(COUNTRIES, r.country), pay(r)].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "rs", label: t("flt.domestic"), predicate: (r) => r.country === "RS" },
          { value: "abroad", label: t("flt.abroad"), predicate: (r) => r.country !== "RS" },
        ]}
        toolbar={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            {crud.canEdit && <AddButton onClick={crud.create} quick={!fixed} />}
          </>
        }
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: "date", dir: "desc" }}
        mIcon={() => (
          <IconTile>
            <Fuel />
          </IconTile>
        )}
        mGroup={(r) => date(r.date)}
        footer={(v) => (
          <TotalRow
            colSpan={cols.length}
            before={amountIdx}
            total={v.reduce((s, r) => s + conv(r.amount, r.currency), 0)}
            after={cols.length - amountIdx}
            extra={<span className="ml-2 text-ink-3 tnum">· {num(v.reduce((s, r) => s + r.liters, 0))} l</span>}
          />
        )}
      />
      {crud.node}
    </>
  );
}

/* ------------------------------ Driver payments ------------------------------ */
export type PaymentRow = {
  id: string;
  employeeId: string;
  date: string;
  kind: string;
  amount: number;
  currency: string;
  method: string;
  note: string | null;
};

export function PaymentsTable({ rows, refs, names, fixed, hide, flush }: Common & { rows: PaymentRow[] }) {
  const { t, date, conv, opt } = usePrefs();
  const crud = useCrud("payments", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const cols = keep<PaymentRow>(
    [
      { key: "date", m: "hide", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "employee", m: "title", header: t("f.employee"), sortValue: (r) => names[r.employeeId] ?? "", render: (r) => <span className="font-medium">{names[r.employeeId] ?? "—"}</span> },
      { key: "kind", m: "sub", header: t("f.kind"), sortValue: (r) => r.kind, render: (r) => <Stack main={<span className="font-normal text-ink-2">{opt(PAYMENT_KINDS, r.kind)}</span>} sub={r.note} /> },
      { key: "method", m: "hide", header: t("f.method"), sortValue: (r) => r.method, hide: "md", render: (r) => <span className="text-ink-2">{opt(PAYMENT_METHODS, r.method)}</span> },
      { key: "amount", m: "end", header: t("f.amount"), align: "right", sortValue: (r) => conv(r.amount, r.currency), render: (r) => <Amount amount={r.amount} currency={r.currency} /> },
    ],
    hide,
  );
  const amountIdx = cols.findIndex((c) => c.key === "amount");
  return (
    <>
      <DataTable
        flush={flush}
        rows={filtered}
        columns={cols}
        searchText={(r) => [names[r.employeeId], r.note, opt(PAYMENT_KINDS, r.kind)].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          ...PAYMENT_KINDS.filter((k) => rows.some((r) => r.kind === k.value)).map((k) => ({ value: k.value, label: opt(PAYMENT_KINDS, k.value), predicate: (r: PaymentRow) => r.kind === k.value })),
        ]}
        toolbar={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            {crud.canEdit && <AddButton onClick={crud.create} quick={!fixed} />}
          </>
        }
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: "date", dir: "desc" }}
        mIcon={() => (
          <IconTile>
            <Wallet />
          </IconTile>
        )}
        mGroup={(r) => date(r.date)}
        footer={(v) => <TotalRow colSpan={cols.length} before={amountIdx} total={v.reduce((s, r) => s + conv(r.amount, r.currency), 0)} after={cols.length - amountIdx} />}
      />
      {crud.node}
    </>
  );
}
