"use client";

import { useState } from "react";
import { Receipt, Repeat } from "lucide-react";
import { DataTable, IconTile, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { Select } from "../ui/client";
import { AddButton, PaidBadge, PeriodSelect, Stack, TotalRow, usePeriod } from "./common";
import { OptionalAmount } from "./records";
import { EXPENSE_CATEGORIES } from "@/lib/catalog";
import { allocationLabel } from "@/lib/expenses";
import type { Refs } from "@/lib/resources";

export type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  supplierId: string | null;
  vehicleId: string | null;
  trailerId: string | null;
  invoiceNo: string | null;
  amount: number | null;
  currency: string;
  paid: boolean;
  costFrom: string | null;
  spreadMonths: number;
  recurring: boolean;
  recurringUntil: string | null;
  parentId: string | null;
};

export function ExpensesTable({
  rows,
  refs,
  names,
  fixed,
  hide,
  flush,
}: {
  rows: ExpenseRow[];
  refs: Refs;
  names: Record<string, string>;
  fixed?: Record<string, string>;
  hide?: string[];
  flush?: boolean;
}) {
  const { t, opt, date, conv, locale } = usePrefs();
  const sr = locale === "sr";
  const crud = useCrud("expenses", refs, fixed);
  const { period, setPeriod, filtered } = usePeriod(rows);
  const [cat, setCat] = useState("all");
  const shown = cat === "all" ? filtered : filtered.filter((r) => r.category === cat);
  const cats = EXPENSE_CATEGORIES.filter((c) => rows.some((r) => r.category === c.value));
  const company = sr ? "Firma" : "Company";

  const all: Column<ExpenseRow>[] = [
    { key: "date", m: "hide", header: t("f.date"), sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap text-ink-2 tnum">{date(r.date)}</span> },
    {
      key: "category", m: "title",
      header: t("f.expenseCategory"),
      sortValue: (r) => opt(EXPENSE_CATEGORIES, r.category),
      render: (r) => (
        <Stack
          main={
            <span className="inline-flex items-center gap-1.5">
              {opt(EXPENSE_CATEGORIES, r.category)}
              {r.recurring && <Repeat size={12} className="text-accent" aria-label={sr ? "mesečno" : "monthly"} />}
            </span>
          }
          sub={r.description}
        />
      ),
    },
    {
      key: "for", m: "sub",
      header: t("f.for"),
      sortValue: (r) => names[r.vehicleId ?? r.trailerId ?? ""] ?? "",
      render: (r) => {
        const n = names[r.vehicleId ?? r.trailerId ?? ""];
        return n ? <span className="font-medium">{n}</span> : <span className="text-ink-3">{company}</span>;
      },
    },
    { key: "supplier", m: "hide", header: t("f.supplier"), hide: "lg", sortValue: (r) => names[r.supplierId ?? ""] ?? "", render: (r) => <span className="text-ink-2">{names[r.supplierId ?? ""] ?? "—"}</span> },
    {
      key: "amount", m: "end",
      header: t("f.amount"),
      align: "right",
      sortValue: (r) => (r.amount === null ? -1 : conv(r.amount, r.currency)),
      render: (r) => {
        const how = allocationLabel(r, locale);
        return (
          <span className="inline-flex flex-col items-end">
            <OptionalAmount amount={r.amount} currency={r.currency} />
            {how && <span className="text-xs whitespace-nowrap text-ink-3">{how}</span>}
          </span>
        );
      },
    },
    { key: "paid", m: "end2", header: t("f.paid"), sortValue: (r) => Number(r.paid), hide: "sm", render: (r) => <PaidBadge paid={r.paid} /> },
  ];
  const cols = hide?.length ? all.filter((c) => !hide.includes(c.key)) : all;
  const amountIdx = cols.findIndex((c) => c.key === "amount");

  return (
    <>
      <DataTable
        flush={flush}
        rows={shown}
        columns={cols}
        searchText={(r) => [opt(EXPENSE_CATEGORIES, r.category), r.description, names[r.vehicleId ?? ""], names[r.trailerId ?? ""], names[r.supplierId ?? ""], r.invoiceNo].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "unpaid", label: t("c.unpaid"), predicate: (r) => !r.paid },
          { value: "noPrice", label: sr ? "Bez cene" : "No price", predicate: (r) => r.amount === null },
          { value: "monthly", label: sr ? "Mesečni" : "Monthly", predicate: (r) => r.recurring },
          { value: "company", label: company, predicate: (r) => !r.vehicleId && !r.trailerId },
        ]}
        toolbar={
          <>
            {cats.length > 1 && (
              <div className="min-w-[40%] flex-1 sm:w-52 sm:min-w-0 sm:flex-none">
                <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t("f.expenseCategory")}>
                  <option value="all">{sr ? "Sve vrste" : "All types"}</option>
                  {cats.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label[locale]}
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
          <IconTile tone="amber">
            <Receipt />
          </IconTile>
        )}
        mGroup={(r) => date(r.date)}
        footer={(v) => <TotalRow colSpan={cols.length} before={amountIdx} total={v.reduce((s, r) => s + conv(r.amount, r.currency), 0)} after={cols.length - amountIdx} />}
      />
      {crud.node}
    </>
  );
}
