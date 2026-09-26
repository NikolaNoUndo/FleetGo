"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { ExpiryBadge } from "../ui/client";
import { AddButton, AssetStatus, EmployeeStatus, Stack } from "./common";
import { DOC_TYPES, EMPLOYEE_ROLES, TRAILER_TYPES, VEHICLE_TYPES } from "@/lib/catalog";
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
  wialonUnitId: string | null;
  notes: string | null;
  driverName: string | null;
  trailerPlate: string | null;
  nextDoc: NextDoc;
};

function NextDocCell({ doc, kind }: { doc: NextDoc; kind: "vehicle" | "trailer" | "employee" }) {
  const { opt } = usePrefs();
  if (!doc) return <span className="text-ink-4">—</span>;
  return (
    <div className="flex items-center gap-2">
      <ExpiryBadge date={doc.expiresAt} compact />
      <span className="text-xs text-ink-3">{opt(DOC_TYPES[kind], doc.docType)}</span>
    </div>
  );
}

export function VehiclesTable({ rows, refs }: { rows: VehicleRow[]; refs: Refs }) {
  const { t, opt, num } = usePrefs();
  const crud = useCrud("vehicles", refs);
  const router = useRouter();
  const cols: Column<VehicleRow>[] = [
    { key: "plate", header: t("f.vehicle"), sortValue: (r) => r.plate, render: (r) => <Stack main={r.plate} sub={[r.brand, r.model, r.year].filter(Boolean).join(" · ")} /> },
    { key: "type", header: t("f.type"), sortValue: (r) => r.type, hide: "md", render: (r) => <span className="text-ink-2">{opt(VEHICLE_TYPES, r.type)}</span> },
    { key: "driver", header: t("f.driver"), sortValue: (r) => r.driverName, hide: "sm", render: (r) => <span className="text-ink-2">{r.driverName ?? "—"}</span> },
    { key: "trailer", header: t("f.trailer"), sortValue: (r) => r.trailerPlate, hide: "lg", render: (r) => <span className="text-ink-2">{r.trailerPlate ?? "—"}</span> },
    { key: "km", header: t("f.odometerKm"), align: "right", hide: "sm", sortValue: (r) => r.odometerKm, render: (r) => <span className="text-ink-2">{r.odometerKm ? `${num(r.odometerKm)} km` : "—"}</span> },
    { key: "next", header: t("f.nextExpiry"), sortValue: (r) => r.nextDoc?.expiresAt ?? "9999", render: (r) => <NextDocCell doc={r.nextDoc} kind="vehicle" /> },
    { key: "status", header: t("f.status"), sortValue: (r) => r.status, hide: "sm", render: (r) => <AssetStatus status={r.status} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        rowHref={(r) => `/vehicles/${r.id}`}
        searchText={(r) => [r.plate, r.brand, r.model, r.vin, r.driverName, r.trailerPlate].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "active", label: t("flt.active"), predicate: (r) => r.status === "active" },
          { value: "in_service", label: t("flt.inService"), predicate: (r) => r.status === "in_service" },
          { value: "inactive", label: t("flt.inactive"), predicate: (r) => r.status === "inactive" },
        ]}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} /> : undefined}
        actions={(r) => crud.menu(r, [{ label: t("c.open"), icon: <ExternalLink />, onSelect: () => router.push(`/vehicles/${r.id}`) }])}
        initialSort={{ key: "plate", dir: "asc" }}
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
  vehicleId: string | null;
  notes: string | null;
  vehiclePlate: string | null;
  nextDoc: NextDoc;
};

export function TrailersTable({ rows, refs }: { rows: TrailerRow[]; refs: Refs }) {
  const { t, opt, num } = usePrefs();
  const crud = useCrud("trailers", refs);
  const router = useRouter();
  const types = [...new Set(rows.map((r) => r.type))];
  const cols: Column<TrailerRow>[] = [
    { key: "plate", header: t("f.trailer"), sortValue: (r) => r.plate, render: (r) => <Stack main={r.plate} sub={[r.brand, r.year].filter(Boolean).join(" · ")} /> },
    { key: "type", header: t("f.type"), sortValue: (r) => r.type, render: (r) => <span className="text-ink-2">{opt(TRAILER_TYPES, r.type)}</span> },
    {
      key: "cap",
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
    { key: "veh", header: t("x.coupledTo"), sortValue: (r) => r.vehiclePlate, hide: "sm", render: (r) => <span className="text-ink-2">{r.vehiclePlate ?? "—"}</span> },
    { key: "next", header: t("f.nextExpiry"), sortValue: (r) => r.nextDoc?.expiresAt ?? "9999", render: (r) => <NextDocCell doc={r.nextDoc} kind="trailer" /> },
    { key: "status", header: t("f.status"), sortValue: (r) => r.status, hide: "sm", render: (r) => <AssetStatus status={r.status} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        rowHref={(r) => `/trailers/${r.id}`}
        searchText={(r) => [r.plate, r.brand, r.vin, r.vehiclePlate, opt(TRAILER_TYPES, r.type)].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          ...types.map((ty) => ({ value: ty, label: opt(TRAILER_TYPES, ty), predicate: (r: TrailerRow) => r.type === ty })),
        ]}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} /> : undefined}
        actions={(r) => crud.menu(r, [{ label: t("c.open"), icon: <ExternalLink />, onSelect: () => router.push(`/trailers/${r.id}`) }])}
        initialSort={{ key: "plate", dir: "asc" }}
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
    { key: "name", header: t("f.name"), sortValue: (r) => `${r.lastName} ${r.firstName}`, render: (r) => <Stack main={`${r.firstName} ${r.lastName}`} sub={r.phone} /> },
    { key: "role", header: t("f.role"), sortValue: (r) => r.role, hide: "sm", render: (r) => <span className="text-ink-2">{opt(EMPLOYEE_ROLES, r.role)}</span> },
    { key: "veh", header: t("x.assignedVehicle"), sortValue: (r) => r.vehiclePlate, hide: "md", render: (r) => <span className="text-ink-2">{r.vehiclePlate ?? "—"}</span> },
    { key: "next", header: t("f.nextExpiry"), sortValue: (r) => r.nextDoc?.expiresAt ?? "9999", render: (r) => <NextDocCell doc={r.nextDoc} kind="employee" /> },
    showPaid && {
      key: "paid",
      header: `${t("x.payments")} · ${t("c.thisMonth").toLowerCase()}`,
      align: "right",
      hide: "lg",
      sortValue: paid,
      render: (r) => <span className="font-medium">{r.paidThisMonth.length ? money(paid(r), currency) : "—"}</span>,
    },
    { key: "status", header: t("f.status"), sortValue: (r) => r.status, hide: "sm", render: (r) => <EmployeeStatus status={r.status} /> },
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
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} /> : undefined}
        actions={(r) => crud.menu(r, [{ label: t("c.open"), icon: <ExternalLink />, onSelect: () => router.push(`/employees/${r.id}`) }])}
        initialSort={{ key: "name", dir: "asc" }}
      />
      {crud.node}
    </>
  );
}
