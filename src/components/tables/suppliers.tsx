"use client";

import { DataTable, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { AddButton, Stack } from "./common";
import type { Refs } from "@/lib/resources";

export type SupplierRow = { id: string; name: string; phone: string | null; note: string | null; parts: number; services: number; spent: number; lastDate: string | null };

export function SuppliersTable({ rows, refs }: { rows: SupplierRow[]; refs: Refs }) {
  const { t, locale, date, currency, money } = usePrefs();
  const crud = useCrud("suppliers", refs);
  const sr = locale === "sr";
  const cols: Column<SupplierRow>[] = [
    { key: "name", header: t("f.name"), sortValue: (r) => r.name, render: (r) => <Stack main={r.name} sub={r.note ?? undefined} /> },
    { key: "phone", header: t("f.phone"), hide: "md", sortValue: (r) => r.phone, render: (r) => <span className="text-ink-2">{r.phone ?? "—"}</span> },
    { key: "parts", header: sr ? "Nabavki delova" : "Part purchases", align: "right", sortValue: (r) => r.parts, render: (r) => <span className="text-ink-2">{r.parts}</span> },
    { key: "services", header: sr ? "Servisa" : "Services", align: "right", sortValue: (r) => r.services, render: (r) => <span className="text-ink-2">{r.services}</span> },
    { key: "last", header: sr ? "Poslednja" : "Last", hide: "sm", sortValue: (r) => r.lastDate, render: (r) => <span className="text-ink-2 tnum">{date(r.lastDate)}</span> },
    { key: "spent", header: sr ? "Ukupno potrošeno" : "Total spent", align: "right", sortValue: (r) => r.spent, render: (r) => <span className="font-medium">{r.spent ? money(r.spent, currency) : "—"}</span> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        searchText={(r) => [r.name, r.phone, r.note].join(" ")}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} /> : undefined}
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: "spent", dir: "desc" }}
      />
      {crud.node}
    </>
  );
}
