import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Info, Receipt, TrendingUp } from "lucide-react";
import { requireAccess } from "@/lib/auth/context";
import { can, type ModuleKey } from "@/lib/auth/permissions";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { DetailTabs, RecordActions } from "@/components/detail";
import { FuelTable, PartsTable, PaymentsTable, ServicesTable } from "@/components/tables/records";
import { ExpensesTable } from "@/components/tables/expenses";
import { tourRoute } from "@/lib/tour-route";
import { getPrefs, getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { allCostSources, COST_KEYS, getTour, listTours, overlapping, tourCosts, tourDays, type CostKey } from "@/lib/tours";
import { getMoney } from "@/lib/money-server";
import { fmtDate, fmtNum } from "@/lib/format";
import type { TKey } from "@/lib/i18n";

export async function generateMetadata(props: PageProps<"/tours/[id]">) {
  const { id } = await props.params;
  const tour = /^[0-9a-f-]{36}$/i.test(id) ? await getTour(id).catch(() => null) : null;
  return { title: tour ? tourRoute(tour) : "Tura" };
}

const CAT: Record<CostKey, { label: TKey; module: ModuleKey }> = {
  fuel: { label: "cat.fuel", module: "fuel" },
  payments: { label: "cat.payments", module: "payments" },
  services: { label: "cat.services", module: "services" },
  parts: { label: "cat.parts", module: "parts" },
  expenses: { label: "cat.expenses", module: "expenses" },
};

export default async function TourPage(props: PageProps<"/tours/[id]">) {
  const ctx = await requireAccess("tours");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tour = await getTour(id);
  if (!tour) notFound();

  const allow = (mod: ModuleKey) => can(ctx.perms, mod);
  const showPrice = allow("tourPrice");
  const showProfit = allow("profit");
  const [t, { locale }, m, { refs, names }, all, src] = await Promise.all([getT(), getPrefs(), getMoney(), getRefs(), listTours(), allCostSources()]);
  const sr = locale === "sr";
  const costs = tourCosts(tour, src);
  // a category is shown to members who may see that part of the app; profit needs them all
  const visible = COST_KEYS.filter((k) => showProfit || allow(CAT[k].module));
  const total = (k: CostKey) => costs[k].reduce((s, r) => s + m.conv(r.amount, r.currency), 0);
  const costSum = COST_KEYS.reduce((s, k) => s + total(k), 0);
  const priceConv = tour.price === null ? null : m.conv(tour.price, tour.currency);
  const profit = priceConv === null ? null : priceConv - costSum;
  const days = tourDays(tour);
  const clash = overlapping(tour, all);
  const liters = costs.fuel.reduce((s, f) => s + f.liters, 0);
  const link = (href: string, label: string | undefined) => (label ? <Link href={href} className="hover:text-accent-ink hover:underline">{label}</Link> : "—");
  const per = (n: number, unit: string) => `${m.fmt(n)} / ${unit}`;

  return (
    <>
      <PageHeader
        detail
        title={tourRoute(tour)}
        sub={`${fmtDate(tour.dateFrom, locale)} – ${tour.dateTo ? fmtDate(tour.dateTo, locale) : sr ? "u toku" : "on the road"} · ${days} ${sr ? (days === 1 ? "dan" : "dana") : days === 1 ? "day" : "days"}`}
        actions={
          can(ctx.perms, "tours", "edit") ? (
            <RecordActions resource="tours" record={{ ...tour, price: showPrice ? tour.price : null, currency: showPrice ? tour.currency : "EUR" }} refs={refs} listHref="/tours" />
          ) : undefined
        }
      />

      {clash.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-sm text-warn-ink">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {sr ? "Ovaj kamion ima i drugu turu u istim danima, pa se isti troškovi računaju na obe: " : "This truck has another tour on the same days, so the same costs count for both: "}
            {clash.map((o, i) => (
              <span key={o.id}>
                {i > 0 && ", "}
                <Link href={`/tours/${o.id}`} className="font-medium underline underline-offset-2">
                  {tourRoute(o)} ({fmtDate(o.dateFrom, locale)})
                </Link>
              </span>
            ))}
          </span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Shell icon={<Info />} title={t("c.details")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label={t("f.vehicle")}>{tour.vehicleId ? link(`/vehicles/${tour.vehicleId}`, names[tour.vehicleId]) : "—"}</Kv>
              <Kv label={t("f.trailer")}>{tour.trailerId ? link(`/trailers/${tour.trailerId}`, names[tour.trailerId]) : "—"}</Kv>
              <Kv label={t("f.driver")}>{tour.driverId ? link(`/employees/${tour.driverId}`, names[tour.driverId]) : "—"}</Kv>
              <Kv label={t("f.client")}>{tour.clientId ? link(`/tours?client=${tour.clientId}`, names[tour.clientId]) : "—"}</Kv>
              <Kv label={t("f.distanceKm")}>{tour.distanceKm ? `${fmtNum(tour.distanceKm, locale)} km` : "—"}</Kv>
              {showPrice && <Kv label={t("f.tourPrice")}>{tour.price !== null ? m.fmt(priceConv!) : "—"}</Kv>}
              {tour.notes && <Kv label={t("f.notes")}>{tour.notes}</Kv>}
            </div>
          </Shell>

          {showProfit ? (
            <Shell icon={<TrendingUp />} title={sr ? "Isplativost" : "Profitability"}>
              <div className="px-4 pt-1 pb-4">
                {profit === null ? (
                  <p className="py-2 text-sm text-ink-3">{sr ? "Upiši cenu ture da bi se izračunala zarada." : "Enter the tour price to work out the profit."}</p>
                ) : (
                  <div className="py-2">
                    <div className="text-xs text-ink-3">{sr ? "Zarada na turi" : "Profit on this tour"}</div>
                    <div className={`mt-0.5 text-2xl font-semibold tracking-tight tnum ${profit < 0 ? "text-bad-ink" : "text-good-ink"}`}>{m.fmt(profit)}</div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {priceConv ? `${Math.round((profit / priceConv) * 100)}% ${sr ? "od cene" : "of the price"}` : ""}
                      {profit < 0 && (sr ? " · tura je u minusu" : " · this tour lost money")}
                    </div>
                  </div>
                )}
                <div className="mt-2 divide-y divide-line/70">
                  {priceConv !== null && <Kv label={t("f.tourPrice")}>{m.fmt(priceConv)}</Kv>}
                  {visible.map((k) => (
                    <Kv key={k} label={t(CAT[k].label)}>
                      <span className="text-ink-2">− {m.fmt(total(k))}</span>
                    </Kv>
                  ))}
                  <Kv label={sr ? "Troškovi ukupno" : "Costs in total"}>− {m.fmt(costSum)}</Kv>
                  {profit !== null && tour.distanceKm ? <Kv label={sr ? "Zarada po km" : "Profit per km"}>{per(profit / tour.distanceKm, "km")}</Kv> : null}
                  {profit !== null && <Kv label={sr ? "Zarada po danu" : "Profit per day"}>{per(profit / days, sr ? "dan" : "day")}</Kv>}
                  {tour.distanceKm ? <Kv label={sr ? "Trošak po km" : "Cost per km"}>{per(costSum / tour.distanceKm, "km")}</Kv> : null}
                </div>
              </div>
            </Shell>
          ) : (
            visible.length > 0 && (
              <Shell icon={<Receipt />} title={sr ? "Troškovi ture" : "Tour costs"}>
                <div className="divide-y divide-line/70 px-4 pb-1.5">
                  {visible.map((k) => (
                    <Kv key={k} label={t(CAT[k].label)}>
                      {m.fmt(total(k))}
                    </Kv>
                  ))}
                </div>
              </Shell>
            )
          )}
          {liters > 0 && allow("fuel") && tour.distanceKm ? (
            <p className="px-1 text-xs text-ink-3">
              {sr ? "Gorivo na turi" : "Fuel on this tour"}: {fmtNum(liters, locale)} l · {fmtNum((liters / tour.distanceKm) * 100, locale, 1)} l/100 km
            </p>
          ) : null}
        </div>

        <DetailTabs
          tabs={[
            allow("fuel") && { key: "fuel", label: t("x.fuel"), count: costs.fuel.length, content: <FuelTable rows={costs.fuel} refs={refs} names={names} fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }} /> },
            allow("payments") && { key: "payments", label: t("cat.payments"), count: costs.payments.length, content: <PaymentsTable rows={costs.payments} refs={refs} names={names} fixed={tour.driverId ? { employeeId: tour.driverId } : undefined} /> },
            allow("services") && { key: "services", label: t("x.services"), count: costs.services.length, content: <ServicesTable rows={costs.services} refs={refs} names={names} fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }} /> },
            allow("parts") && { key: "parts", label: t("x.parts"), count: costs.parts.length, content: <PartsTable rows={costs.parts} refs={refs} names={names} fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }} /> },
            allow("expenses") && { key: "expenses", label: t("cat.expenses"), count: costs.expenses.length, content: <ExpensesTable rows={costs.expenses} refs={refs} names={names} fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }} /> },
          ]}
        />
      </div>
    </>
  );
}
