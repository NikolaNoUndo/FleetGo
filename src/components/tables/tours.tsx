"use client";

import { Handshake, Route } from "lucide-react";
import { DataTable, IconTile, type Column } from "../data-table";
import { useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { cn } from "../ui/primitives";
import { AddButton, Amount, PeriodSelect, Stack, usePeriod } from "./common";
import type { Refs } from "@/lib/resources";
import { todayISO } from "@/lib/format";
import { tourRoute } from "@/lib/tour-route";

export type TourRowView = {
  id: string;
  dateFrom: string;
  dateTo: string | null;
  fromPlace: string | null;
  toPlace: string | null;
  vehicleId: string | null;
  trailerId: string | null;
  driverId: string | null;
  clientId: string | null;
  distanceKm: number | null;
  notes: string | null;
  days: number;
  price?: number | null;
  currency?: string;
  costs?: number;
  profit?: number | null;
};

const onRoad = (r: { dateFrom: string; dateTo: string | null }) => !r.dateTo || r.dateTo >= todayISO();

/** Profit with its sign colour (only filled in for members who may see it). */
export function Profit({ value }: { value: number | null | undefined }) {
  const { money, currency } = usePrefs();
  if (value === null || value === undefined) return <span className="text-ink-4">—</span>;
  return <span className={cn("font-medium", value < 0 ? "text-bad-ink" : "text-good-ink")}>{money(value, currency)}</span>;
}

export function ToursTable({
  rows,
  refs,
  names,
  fixed,
  hide,
  flush,
  showPrice,
  showProfit,
}: {
  rows: TourRowView[];
  refs: Refs;
  names: Record<string, string>;
  fixed?: Record<string, string>;
  hide?: string[];
  flush?: boolean;
  showPrice: boolean;
  showProfit: boolean;
}) {
  const { t, locale, date, num, money, currency } = usePrefs();
  const sr = locale === "sr";
  const crud = useCrud("tours", refs, fixed);
  const dated = rows.map((r) => ({ ...r, date: r.dateFrom }));
  const { period, setPeriod, filtered } = usePeriod(dated);
  const span = (r: TourRowView) => `${date(r.dateFrom)} – ${r.dateTo ? date(r.dateTo) : sr ? "u toku" : "on the road"}`;
  const all: (Column<TourRowView> | false)[] = [
    {
      key: "date",
      m: "hide",
      header: sr ? "Period" : "Dates",
      sortValue: (r) => r.dateFrom,
      render: (r) => <Stack main={<span className="font-normal whitespace-nowrap text-ink-2 tnum">{span(r)}</span>} sub={`${r.days} ${sr ? (r.days === 1 ? "dan" : "dana") : r.days === 1 ? "day" : "days"}`} />,
    },
    {
      key: "route",
      m: "title",
      header: sr ? "Relacija" : "Route",
      sortValue: (r) => tourRoute(r),
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          {tourRoute(r)}
          {onRoad(r) && <span className="rounded-md border border-accent-line bg-accent-soft px-1.5 text-xs font-normal text-accent-ink">{sr ? "u toku" : "on the road"}</span>}
        </span>
      ),
    },
    { key: "vehicle", m: "sub", header: t("f.vehicle"), sortValue: (r) => names[r.vehicleId ?? ""] ?? "", render: (r) => <Stack main={<span className="font-normal text-ink-2">{names[r.vehicleId ?? ""] ?? "—"}</span>} sub={r.trailerId ? names[r.trailerId] : undefined} /> },
    { key: "driver", m: "hide", header: t("f.driver"), hide: "md", sortValue: (r) => names[r.driverId ?? ""] ?? "", render: (r) => <span className="text-ink-2">{names[r.driverId ?? ""] ?? "—"}</span> },
    { key: "client", m: "meta", header: t("f.client"), hide: "sm", sortValue: (r) => names[r.clientId ?? ""] ?? "", render: (r) => <span className="text-ink-2">{names[r.clientId ?? ""] ?? "—"}</span> },
    { key: "km", m: "hide", header: "km", align: "right", hide: "lg", sortValue: (r) => r.distanceKm, render: (r) => <span className="text-ink-3">{r.distanceKm ? num(r.distanceKm) : "—"}</span> },
    showPrice && { key: "price", m: showProfit ? "end2" : "end", header: t("f.tourPrice"), align: "right", sortValue: (r) => r.price ?? null, render: (r) => (r.price ? <Amount amount={r.price} currency={r.currency ?? "EUR"} /> : <span className="text-ink-4">—</span>) },
    showProfit && { key: "profit", m: "end", header: sr ? "Zarada" : "Profit", align: "right", sortValue: (r) => r.profit ?? null, render: (r) => <Profit value={r.profit} /> },
  ];
  const cols = (all.filter(Boolean) as Column<TourRowView>[]).filter((c) => !hide?.includes(c.key));
  return (
    <>
      <DataTable
        flush={flush}
        rows={filtered}
        columns={cols}
        rowHref={(r) => `/tours/${r.id}`}
        searchText={(r) => [tourRoute(r), names[r.vehicleId ?? ""], names[r.trailerId ?? ""], names[r.driverId ?? ""], names[r.clientId ?? ""], r.notes].join(" ")}
        filters={[
          { value: "all", label: t("c.all"), predicate: () => true },
          { value: "road", label: sr ? "U toku" : "On the road", predicate: (r) => onRoad(r) },
          { value: "done", label: sr ? "Završene" : "Finished", predicate: (r) => !onRoad(r) },
          ...(showProfit ? [{ value: "loss", label: sr ? "U minusu" : "At a loss", predicate: (r: TourRowView) => (r.profit ?? 0) < 0 }] : []),
        ]}
        toolbar={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            {crud.canEdit && <AddButton onClick={crud.create} quick={!fixed} />}
          </>
        }
        actions={crud.canEdit ? (r) => crud.menu({ ...r, price: r.price ?? null, currency: r.currency ?? "EUR" }) : undefined}
        initialSort={{ key: "date", dir: "desc" }}
        mIcon={() => (
          <IconTile>
            <Route />
          </IconTile>
        )}
        mGroup={(r) => date(r.dateFrom)}
        footer={
          showProfit
            ? (v) => (
                <tr className="border-t border-line bg-surface-2 text-sm font-semibold">
                    <td colSpan={cols.length + 1} className="h-10 px-4 text-right">
                      <span className="mr-2 font-normal text-ink-3">{sr ? "Ukupna zarada" : "Total profit"}</span>
                      <Profit value={v.reduce((s, r) => s + (r.profit ?? 0), 0)} />
                      <span className="ml-3 font-normal text-ink-3">
                        · {sr ? "troškovi" : "costs"} {money(v.reduce((s, r) => s + (r.costs ?? 0), 0), currency)}
                      </span>
                    </td>
                  </tr>
              )
            : undefined
        }
      />
      {crud.node}
    </>
  );
}

export type ClientRow = { id: string; name: string; phone: string | null; note: string | null; tours: number; lastDate: string | null; revenue?: number; profit?: number };

export function ClientsTable({ rows, refs, showPrice, showProfit }: { rows: ClientRow[]; refs: Refs; showPrice: boolean; showProfit: boolean }) {
  const { t, locale, date, money, currency } = usePrefs();
  const sr = locale === "sr";
  const crud = useCrud("clients", refs);
  const all: (Column<ClientRow> | false)[] = [
    { key: "name", m: "title", header: t("f.name"), sortValue: (r) => r.name, render: (r) => <Stack main={r.name} sub={r.note ?? undefined} /> },
    { key: "phone", m: "hide", header: t("f.phone"), hide: "md", sortValue: (r) => r.phone, render: (r) => <span className="text-ink-2">{r.phone ?? "—"}</span> },
    { key: "tours", m: "sub", header: sr ? "Tura" : "Tours", align: "right", sortValue: (r) => r.tours, render: (r) => <span className="text-ink-2">{r.tours}</span> },
    { key: "last", m: "hide", header: sr ? "Poslednja" : "Last", hide: "sm", sortValue: (r) => r.lastDate, render: (r) => <span className="text-ink-2 tnum">{date(r.lastDate)}</span> },
    showPrice && { key: "revenue", m: showProfit ? "end2" : "end", header: sr ? "Prihod" : "Revenue", align: "right", sortValue: (r) => r.revenue ?? 0, render: (r) => <span className="font-medium">{r.revenue ? money(r.revenue, currency) : "—"}</span> },
    showProfit && { key: "profit", m: "end", header: sr ? "Zarada" : "Profit", align: "right", sortValue: (r) => r.profit ?? 0, render: (r) => <Profit value={r.tours ? r.profit : null} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={all.filter(Boolean) as Column<ClientRow>[]}
        rowHref={(r) => `/tours?client=${r.id}`}
        searchText={(r) => [r.name, r.phone, r.note].join(" ")}
        toolbar={crud.canEdit ? <AddButton onClick={crud.create} /> : undefined}
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: showProfit ? "profit" : "tours", dir: "desc" }}
        mIcon={() => (
          <IconTile>
            <Handshake />
          </IconTile>
        )}
      />
      {crud.node}
    </>
  );
}
