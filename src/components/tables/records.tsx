"use client";

import { RefreshCw, Truck, Container, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { ExpiryBadge, Select } from "../ui/client";
import { AddButton, Amount, PaidBadge, PeriodSelect, Stack, TotalRow, usePeriod } from "./common";
import { COUNTRIES, DOC_TYPES, DOC_VALIDITY_DAYS, addDaysISO, ENTITY_TYPES, FUEL_PAYMENT, PAYMENT_KINDS, PAYMENT_METHODS, SERVICE_KINDS, type EntityType } from "@/lib/catalog";
import { expiryState, todayISO } from "@/lib/format";
import type { Refs } from "@/lib/resources";

type Common = { refs: Refs; names: Record<string, string>; fixed?: Record<string, string>; hide?: string[]; flush?: boolean };
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

  const renew = (r: DocRow) => {
    const today = todayISO();
    let span = DOC_VALIDITY_DAYS[r.docType] ?? 365;
    if (r.issuedAt && r.expiresAt) span = Math.max(1, Math.round((Date.parse(r.expiresAt) - Date.parse(r.issuedAt)) / 86400000));
    // Keep the anniversary if renewed early; start from today if it already lapsed.
    const base = r.expiresAt && r.expiresAt > today ? r.expiresAt : today;
    crud.edit({ ...r, issuedAt: today, expiresAt: addDaysISO(base, span) });
  };

  const cols: Column<DocRow>[] = [
    {
      key: "doc",
      header: t("f.docType"),
      sortValue: (r) => opt(DOC_TYPES[r.entityType as EntityType] ?? [], r.docType),
      render: (r) => <Stack main={opt(DOC_TYPES[r.entityType as EntityType] ?? [], r.docType)} sub={r.number} />,
    },
    {
      key: "owner",
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
    { key: "issued", header: t("f.issuedAt"), sortValue: (r) => r.issuedAt, hide: "lg", render: (r) => <span className="text-ink-2 tnum">{date(r.issuedAt)}</span> },
    { key: "expires", header: t("f.expiresAt"), sortValue: (r) => r.expiresAt, render: (r) => <span className="font-medium tnum">{date(r.expiresAt)}</span> },
    { key: "state", header: t("f.status"), sortValue: (r) => r.expiresAt, render: (r) => <ExpiryBadge date={r.expiresAt} compact /> },
    { key: "amount", header: t("f.amount"), align: "right", hide: "md", sortValue: (r) => r.amount, render: (r) => (r.amount ? <Amount amount={r.amount} currency={r.currency} /> : <span className="text-ink-4">—</span>) },
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
              <div className="w-full sm:w-40">
                <Select value={entity} onChange={(e) => setEntity(e.target.value as typeof entity)} className="h-9 text-sm">
                  <option value="all">{t("c.all")}</option>
                  {ENTITY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label[locale]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <AddButton onClick={crud.create} />
          </>
        }
        actions={(r) => crud.menu(r, [{ label: t("c.renew"), icon: <RefreshCw />, onSelect: () => renew(r) }])}
        initialSort={{ key: "expires", dir: "asc" }}
      />
      {crud.node}
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
  workshop: string | null;
  invoiceNo: string | null;
  amount: number;
  currency: string;
  paid: boolean;
};

export function ServicesTable({ rows, refs, names, fixed, hide, flush }: Common & { rows: ServiceRow[] }) {
  const { t, opt, date, conv } = usePrefs();
  const crud = useCrud("services", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const cols = keep<ServiceRow>(
    [
      { key: "date", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "for", header: t("f.for"), sortValue: (r) => names[r.vehicleId ?? r.trailerId ?? ""] ?? "", render: (r) => <span className="font-medium">{names[r.vehicleId ?? r.trailerId ?? ""] ?? "—"}</span> },
      { key: "kind", header: t("f.kind"), sortValue: (r) => r.kind, render: (r) => <Stack main={opt(SERVICE_KINDS, r.kind)} sub={r.description} /> },
      { key: "workshop", header: t("f.workshop"), sortValue: (r) => r.workshop, hide: "lg", render: (r) => <span className="text-ink-2">{r.workshop ?? "—"}</span> },
      { key: "amount", header: t("f.amount"), align: "right", sortValue: (r) => conv(r.amount, r.currency), render: (r) => <Amount amount={r.amount} currency={r.currency} /> },
      { key: "paid", header: t("f.paid"), sortValue: (r) => Number(r.paid), hide: "sm", render: (r) => <PaidBadge paid={r.paid} /> },
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
        searchText={(r) => [names[r.vehicleId ?? ""], names[r.trailerId ?? ""], r.description, r.workshop, r.invoiceNo, opt(SERVICE_KINDS, r.kind)].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "unpaid", label: t("c.unpaid"), predicate: (r) => !r.paid },
        ]}
        toolbar={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <AddButton onClick={crud.create} />
          </>
        }
        actions={(r) => crud.menu(r)}
        initialSort={{ key: "date", dir: "desc" }}
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
  supplier: string | null;
  vehicleId: string | null;
  trailerId: string | null;
  date: string;
  invoiceNo: string | null;
  amount: number;
  currency: string;
  paid: boolean;
};

export function PartsTable({ rows, refs, names, fixed, hide, flush }: Common & { rows: PartRow[] }) {
  const { t, date, conv, num } = usePrefs();
  const crud = useCrud("parts", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const cols = keep<PartRow>(
    [
      { key: "date", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "name", header: t("f.partName"), sortValue: (r) => r.name, render: (r) => <Stack main={r.name} sub={r.partNumber} /> },
      { key: "qty", header: t("f.quantity"), align: "right", sortValue: (r) => r.quantity, hide: "sm", render: (r) => <span className="text-ink-2">{num(r.quantity)}</span> },
      { key: "for", header: t("f.for"), sortValue: (r) => names[r.vehicleId ?? r.trailerId ?? ""] ?? "", render: (r) => <span className="font-medium">{names[r.vehicleId ?? r.trailerId ?? ""] ?? "—"}</span> },
      { key: "supplier", header: t("f.supplier"), sortValue: (r) => r.supplier, hide: "lg", render: (r) => <span className="text-ink-2">{r.supplier ?? "—"}</span> },
      { key: "amount", header: t("f.amount"), align: "right", sortValue: (r) => conv(r.amount, r.currency), render: (r) => <Amount amount={r.amount} currency={r.currency} /> },
      { key: "paid", header: t("f.paid"), sortValue: (r) => Number(r.paid), hide: "sm", render: (r) => <PaidBadge paid={r.paid} /> },
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
        searchText={(r) => [r.name, r.partNumber, r.supplier, r.invoiceNo, names[r.vehicleId ?? ""], names[r.trailerId ?? ""]].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "unpaid", label: t("c.unpaid"), predicate: (r) => !r.paid },
        ]}
        toolbar={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <AddButton onClick={crud.create} />
          </>
        }
        actions={(r) => crud.menu(r)}
        initialSort={{ key: "date", dir: "desc" }}
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
  amount: number;
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
      { key: "date", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "vehicle", header: t("f.vehicle"), sortValue: (r) => names[r.vehicleId ?? ""] ?? "", render: (r) => <span className="font-medium">{names[r.vehicleId ?? ""] ?? "—"}</span> },
      { key: "driver", header: t("f.driver"), sortValue: (r) => names[r.employeeId ?? ""] ?? "", hide: "md", render: (r) => <span className="text-ink-2">{names[r.employeeId ?? ""] ?? "—"}</span> },
      { key: "station", header: t("f.station"), sortValue: (r) => r.country, hide: "lg", render: (r) => <Stack main={<span className="font-normal text-ink-2">{r.station ?? "—"}</span>} sub={opt(COUNTRIES, r.country)} /> },
      { key: "liters", header: t("f.liters"), align: "right", sortValue: (r) => r.liters, render: (r) => <span className="text-ink-2">{num(r.liters, 1)} l</span> },
      { key: "ppl", header: t("f.pricePerL"), align: "right", hide: "sm", sortValue: (r) => conv(r.amount / r.liters, r.currency), render: (r) => <span className="text-ink-3">{money(r.amount / r.liters, r.currency === "RSD" ? "RSD" : "EUR")}</span> },
      { key: "amount", header: t("f.amount"), align: "right", sortValue: (r) => conv(r.amount, r.currency), render: (r) => <Amount amount={r.amount} currency={r.currency} /> },
      { key: "km", header: t("f.odometerKm"), align: "right", hide: "lg", sortValue: (r) => r.odometerKm, render: (r) => <span className="text-ink-3">{r.odometerKm ? num(r.odometerKm) : "—"}</span> },
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
            <AddButton onClick={crud.create} />
          </>
        }
        actions={(r) => crud.menu(r)}
        initialSort={{ key: "date", dir: "desc" }}
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
      { key: "date", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
      { key: "employee", header: t("f.employee"), sortValue: (r) => names[r.employeeId] ?? "", render: (r) => <span className="font-medium">{names[r.employeeId] ?? "—"}</span> },
      { key: "kind", header: t("f.kind"), sortValue: (r) => r.kind, render: (r) => <Stack main={<span className="font-normal text-ink-2">{opt(PAYMENT_KINDS, r.kind)}</span>} sub={r.note} /> },
      { key: "method", header: t("f.method"), sortValue: (r) => r.method, hide: "md", render: (r) => <span className="text-ink-2">{opt(PAYMENT_METHODS, r.method)}</span> },
      { key: "amount", header: t("f.amount"), align: "right", sortValue: (r) => conv(r.amount, r.currency), render: (r) => <Amount amount={r.amount} currency={r.currency} /> },
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
            <AddButton onClick={crud.create} />
          </>
        }
        actions={(r) => crud.menu(r)}
        initialSort={{ key: "date", dir: "desc" }}
        footer={(v) => <TotalRow colSpan={cols.length} before={amountIdx} total={v.reduce((s, r) => s + conv(r.amount, r.currency), 0)} after={cols.length - amountIdx} />}
      />
      {crud.node}
    </>
  );
}
