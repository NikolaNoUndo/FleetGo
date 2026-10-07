"use client";

import { Container, ExternalLink, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable, IconTile, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { ExpiryBadge } from "../ui/client";
import { AddButton, AssetStatus, EmployeeStatus, Stack } from "./common";
import { DOC_TYPES, READING_OPTIONS, EMPLOYEE_ROLES, TRAILER_TYPES, VEHICLE_TYPES } from "@/lib/catalog";
import type { Refs } from "@/lib/resources";

type NextDoc = { docType: string; expiresAt: string | null } | null;

export type VehicleRow = {
  id: string;
  plate: string;
  type: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  euroNorm: string | null;
  odometerKm: number | null;
  status: string;
  driverId: string | null;
  extraDriverIds: string[];
  wialonUnitId: string | null;
  notes: string | null;
  driverName: string | null;
  extraDriverNames: string[];
  trailerIds: string[];
  trailerPlates: string[];
  nextDoc: NextDoc;
};

/** "Marko Petrović +1"; hovering shows every driver. */
function DriversCell({ main, extra }: { main: string | null; extra: string[] }) {
  return <ListCell items={[main, ...extra].filter(Boolean) as string[]} />;
}

/** First item plus "+N"; hovering shows all of them. */
function ListCell({ items: all }: { items: string[] }) {
  if (!all.length) return <span className="text-ink-4">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-2" title={all.join("\n")}>
      <span className="truncate">{all[0]}</span>
      {all.length > 1 && <span className="rounded-md border border-line bg-surface-2 px-1.5 text-xs font-medium text-ink-2 tnum">+{all.length - 1}</span>}
    </span>
  );
}

/** Phone card: the badge, and which document under it. */
function NextDocCard({ doc, kind }: { doc: NextDoc; kind: "vehicle" | "trailer" | "employee" }) {
  const { opt } = usePrefs();
  if (!doc) return <span className="text-ink-4">—</span>;
  return (
    <span className="flex flex-col items-end gap-1">
      <ExpiryBadge date={doc.expiresAt} docType={doc.docType} compact />
      <span className="max-w-[128px] truncate text-xs text-ink-3">{opt([...DOC_TYPES[kind], ...READING_OPTIONS], doc.docType)}</span>
    </span>
  );
}

function NextDocCell({ doc, kind }: { doc: NextDoc; kind: "vehicle" | "trailer" | "employee" }) {
  const { opt } = usePrefs();
  if (!doc) return <span className="text-ink-4">—</span>;
  return (
    <div className="flex items-center gap-2">
      <ExpiryBadge date={doc.expiresAt} docType={doc.docType} compact />
      <span className="text-xs text-ink-3">{opt([...DOC_TYPES[kind], ...READING_OPTIONS], doc.docType)}</span>
    </div>
  );
}

export function VehiclesTable({ rows, refs }: { rows: VehicleRow[]; refs: Refs }) {
  const { t, opt, num } = usePrefs();
  const crud = useCrud("vehicles", refs);
  const router = useRouter();
  const cols: Column<VehicleRow>[] = [
    { key: "plate", m: "title", header: t("f.vehicle"), sortValue: (r) => r.plate, render: (r) => <Stack main={r.plate} sub={[r.brand, r.model, r.year].filter(Boolean).join(" · ")} /> },
    { key: "type", m: "hide", header: t("f.type"), sortValue: (r) => r.type, hide: "md", render: (r) => <span className="text-ink-2">{opt(VEHICLE_TYPES, r.type)}</span> },
    { key: "driver", m: "sub", header: t("f.driver"), sortValue: (r) => r.driverName, hide: "sm", render: (r) => <DriversCell main={r.driverName} extra={r.extraDriverNames} />, mRender: (r) => (r.driverName || r.extraDriverNames.length ? <DriversCell main={r.driverName} extra={r.extraDriverNames} /> : null) },
    { key: "trailer", m: "sub", header: t("f.trailer"), sortValue: (r) => r.trailerPlates[0] ?? null, hide: "lg", render: (r) => <ListCell items={r.trailerPlates} />, mRender: (r) => (r.trailerPlates.length ? <ListCell items={r.trailerPlates} /> : null) },
    { key: "km", m: "hide", header: t("f.odometerKm"), align: "right", hide: "sm", sortValue: (r) => r.odometerKm, render: (r) => <span className="text-ink-2">{r.odometerKm ? `${num(r.odometerKm)} km` : "—"}</span> },
    { key: "next", m: "end", header: t("f.nextExpiry"), sortValue: (r) => r.nextDoc?.expiresAt ?? "9999", render: (r) => <NextDocCell doc={r.nextDoc} kind="vehicle" />, mRender: (r) => <NextDocCard doc={r.nextDoc} kind="vehicle" /> },
    { key: "status", m: "hide", header: t("f.status"), sortValue: (r) => r.status, hide: "sm", render: (r) => <AssetStatus status={r.status} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        rowHref={(r) => `/vehicles/${r.id}`}
        searchText={(r) => [r.plate, r.brand, r.model, r.vin, r.driverName, ...r.extraDriverNames, ...r.trailerPlates].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "active", label: t("flt.active"), predicate: (r) => r.status === "active" },
          { value: "in_service", label: t("flt.inService"), predicate: (r) => r.status === "in_service" },
          { value: "inactive", label: t("flt.inactive"), predicate: (r) => r.status === "inactive" },
        ]}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} quick /> : undefined}
        actions={(r) => crud.menu(r, [{ label: t("c.open"), icon: <ExternalLink />, onSelect: () => router.push(`/vehicles/${r.id}`) }])}
        initialSort={{ key: "plate", dir: "asc" }}
        mIcon={(r) => (
          <IconTile>
            <Truck />
          </IconTile>
        )}
      />
      {crud.node}
    </>
  );
}

export type TrailerRow = {
  id: string;
  plate: string;
  type: string;
  brand: string | null;
  year: number | null;
  vin: string | null;
  axles: number | null;
  capacityKg: number | null;
  status: string;
  notes: string | null;
  vehicleIds: string[];
  vehiclePlates: string[];
  nextDoc: NextDoc;
};

export function TrailersTable({ rows, refs }: { rows: TrailerRow[]; refs: Refs }) {
  const { t, opt, num } = usePrefs();
  const crud = useCrud("trailers", refs);
  const router = useRouter();
  const types = [...new Set(rows.map((r) => r.type))];
  const cols: Column<TrailerRow>[] = [
    { key: "plate", m: "title", header: t("f.trailer"), sortValue: (r) => r.plate, render: (r) => <Stack main={r.plate} sub={[r.brand, r.year].filter(Boolean).join(" · ")} /> },
    { key: "type", m: "sub", header: t("f.type"), sortValue: (r) => r.type, render: (r) => <span className="text-ink-2">{opt(TRAILER_TYPES, r.type)}</span> },
    {
      key: "cap", m: "hide",
      header: t("f.capacityKg"),
      align: "right",
      hide: "md",
      sortValue: (r) => r.capacityKg,
      render: (r) => (
        <span className="text-ink-2">
          {r.capacityKg ? `${num(r.capacityKg)} kg` : "—"}
          {r.axles ? <span className="text-ink-4"> · {r.axles}×</span> : null}
        </span>
      ),
    },
    { key: "veh", m: "sub", header: t("x.coupledTo"), sortValue: (r) => r.vehiclePlates[0] ?? null, hide: "sm", render: (r) => <ListCell items={r.vehiclePlates} />, mRender: (r) => (r.vehiclePlates.length ? <ListCell items={r.vehiclePlates} /> : null) },
    { key: "next", m: "end", header: t("f.nextExpiry"), sortValue: (r) => r.nextDoc?.expiresAt ?? "9999", render: (r) => <NextDocCell doc={r.nextDoc} kind="trailer" />, mRender: (r) => <NextDocCard doc={r.nextDoc} kind="trailer" /> },
    { key: "status", m: "hide", header: t("f.status"), sortValue: (r) => r.status, hide: "sm", render: (r) => <AssetStatus status={r.status} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        rowHref={(r) => `/trailers/${r.id}`}
        searchText={(r) => [r.plate, r.brand, r.vin, ...r.vehiclePlates, opt(TRAILER_TYPES, r.type)].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          ...types.map((ty) => ({ value: ty, label: opt(TRAILER_TYPES, ty), predicate: (r: TrailerRow) => r.type === ty })),
        ]}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} quick /> : undefined}
        actions={(r) => crud.menu(r, [{ label: t("c.open"), icon: <ExternalLink />, onSelect: () => router.push(`/trailers/${r.id}`) }])}
        initialSort={{ key: "plate", dir: "asc" }}
        mIcon={(r) => (
          <IconTile>
            <Container />
          </IconTile>
        )}
      />
      {crud.node}
    </>
  );
}

export type EmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  email: string | null;
  hiredAt: string | null;
  status: string;
  notes: string | null;
  vehiclePlate: string | null;
  paidThisMonth: { amount: number; currency: string }[];
  nextDoc: NextDoc;
};

export function EmployeesTable({ rows, refs }: { rows: EmployeeRow[]; refs: Refs }) {
  const { t, opt, conv, currency, money, can } = usePrefs();
  const crud = useCrud("employees", refs);
  const showPaid = can("payments");
  const router = useRouter();
  const paid = (r: EmployeeRow) => r.paidThisMonth.reduce((s, p) => s + conv(p.amount, p.currency), 0);
  const cols = ([
    { key: "name", m: "title", header: t("f.name"), sortValue: (r) => `${r.lastName} ${r.firstName}`, render: (r) => <Stack main={`${r.firstName} ${r.lastName}`} sub={r.phone} /> },
    { key: "role", m: "sub", header: t("f.role"), sortValue: (r) => r.role, hide: "sm", render: (r) => <span className="text-ink-2">{opt(EMPLOYEE_ROLES, r.role)}</span> },
    { key: "veh", m: "sub", header: t("x.assignedVehicle"), sortValue: (r) => r.vehiclePlate, hide: "md", render: (r) => <span className="text-ink-2">{r.vehiclePlate ?? "—"}</span> },
    { key: "next", m: "end", header: t("f.nextExpiry"), sortValue: (r) => r.nextDoc?.expiresAt ?? "9999", render: (r) => <NextDocCell doc={r.nextDoc} kind="employee" />, mRender: (r) => <NextDocCard doc={r.nextDoc} kind="employee" /> },
    showPaid && {
      key: "paid", m: "hide",
      header: `${t("x.payments")} · ${t("c.thisMonth").toLowerCase()}`,
      align: "right",
      hide: "lg",
      sortValue: paid,
      render: (r) => <span className="font-medium">{r.paidThisMonth.length ? money(paid(r), currency) : "—"}</span>,
    },
    { key: "status", m: "hide", header: t("f.status"), sortValue: (r) => r.status, hide: "sm", render: (r) => <EmployeeStatus status={r.status} /> },
  ] as (Column<EmployeeRow> | false)[]).filter(Boolean) as Column<EmployeeRow>[];
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        rowHref={(r) => `/employees/${r.id}`}
        searchText={(r) => [r.firstName, r.lastName, r.phone, r.email, r.vehiclePlate].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "drivers", label: t("flt.drivers"), predicate: (r) => r.role === "driver" },
          { value: "staff", label: t("flt.staff"), predicate: (r) => r.role !== "driver" },
        ]}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} quick /> : undefined}
        actions={(r) => crud.menu(r, [{ label: t("c.open"), icon: <ExternalLink />, onSelect: () => router.push(`/employees/${r.id}`) }])}
        initialSort={{ key: "name", dir: "asc" }}
        mIcon={(r) => <IconTile>{`${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`.toUpperCase()}</IconTile>}
      />
      {crud.node}
    </>
  );
}
