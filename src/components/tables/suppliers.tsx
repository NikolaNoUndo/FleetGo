"use client";

import { Store } from "lucide-react";
import { DataTable, IconTile, type Column } from "../data-table";
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
    { key: "name", m: "title", header: t("f.name"), sortValue: (r) => r.name, render: (r) => <Stack main={r.name} sub={r.note ?? undefined} /> },
    { key: "phone", m: "sub", header: t("f.phone"), hide: "md", sortValue: (r) => r.phone, render: (r) => <span className="text-ink-2">{r.phone ?? "—"}</span> },
    { key: "parts", m: "meta", header: sr ? "Nabavki delova" : "Part purchases", align: "right", sortValue: (r) => r.parts, render: (r) => <span className="text-ink-2">{r.parts}</span> },
    { key: "services", m: "meta", header: sr ? "Servisa" : "Services", align: "right", sortValue: (r) => r.services, render: (r) => <span className="text-ink-2">{r.services}</span> },
    { key: "last", m: "hide", header: sr ? "Poslednja" : "Last", hide: "sm", sortValue: (r) => r.lastDate, render: (r) => <span className="text-ink-2 tnum">{date(r.lastDate)}</span> },
    { key: "spent", m: "end", header: sr ? "Ukupno potrošeno" : "Total spent", align: "right", sortValue: (r) => r.spent, render: (r) => <span className="font-medium">{r.spent ? money(r.spent, currency) : "—"}</span> },
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
        mIcon={() => (
          <IconTile>
            <Store />
          </IconTile>
        )}
      />
      {crud.node}
    </>
  );
}
