import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Info, Receipt, TrendingUp, Ticket } from "lucide-react";
import { requireAccess } from "@/lib/auth/context";
import { can, type ModuleKey } from "@/lib/auth/permissions";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { DetailTabs, RecordActions } from "@/components/detail";
import {
  FuelTable,
  PartsTable,
  PaymentsTable,
  ServicesTable,
} from "@/components/tables/records";
import { ExpensesTable } from "@/components/tables/expenses";
import { legsRoute } from "@/lib/tour-route";
import { LegsTable } from "@/components/tables/tours";
import { getPrefs, getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import {
  allCostSources,
  COST_KEYS,
  getTour,
  legsByTour,
  legView,
  listLegs,
  listTours,
  overlapping,
  tourCosts,
  tourDays,
  tourPrice,
  tourToll,
  type CostKey,
} from "@/lib/tours";
import { TollCard, type TollView } from "@/components/toll-card";
import { tollKey } from "@/lib/tolls/countries";
import { rampSystem } from "@/lib/tolls/ramps";
import { tollStale } from "@/lib/tolls/server";
import { getMoney } from "@/lib/money-server";
import { fmtDate, fmtNum } from "@/lib/format";
import type { TKey } from "@/lib/i18n";

export async function generateMetadata(props: PageProps<"/tours/[id]">) {
  const { id } = await props.params;
  const tour = /^[0-9a-f-]{36}$/i.test(id)
    ? await getTour(id).catch(() => null)
    : null;
  const legs = tour
    ? (await listLegs()).filter((l) => l.tourId === tour.id)
    : [];
  return { title: tour && legs.length ? legsRoute(legs) : "Tura" };
}

/** working out tolls loads the truck's track from Wialon in a server action on this page */
export const maxDuration = 60;

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
  const [t, { locale }, m, { refs, names }, all, src, allLegs] =
    await Promise.all([
      getT(),
      getPrefs(),
      getMoney(),
      getRefs(),
      listTours(),
      allCostSources(),
      listLegs(),
    ]);
  const byTour = legsByTour(allLegs);
  const legs = byTour.get(tour.id) ?? [];
  const routeOf = (id: string) => legsRoute(byTour.get(id) ?? []);
  const clientIds = [
    ...new Set(legs.map((l) => l.clientId).filter((x): x is string => !!x)),
  ];
  const km =
    tour.distanceKm ??
    (legs.some((l) => l.distanceKm)
      ? legs.reduce((s, l) => s + (l.distanceKm ?? 0), 0)
      : null);
  const sr = locale === "sr";
  const costs = tourCosts(tour, src);
  // a category is shown to members who may see that part of the app; profit needs them all
  const visible = COST_KEYS.filter((k) => showProfit || allow(CAT[k].module));
  const total = (k: CostKey) =>
    costs[k].reduce((s, r) => s + m.conv(r.amount, r.currency), 0);
  const toll = tourToll(tour, m.conv);
  const costSum = COST_KEYS.reduce((s, k) => s + total(k), 0) + toll.amount;
  const calc = tour.tollCalc;
  const num = (n: number, d = 0) => fmtNum(n, locale, d);
  const tollView: TollView = {
    source: toll.source,
    totalFmt: toll.source ? m.fmt(toll.amount) : null,
    manual:
      tour.tollManual !== null
        ? { amount: tour.tollManual, currency: tour.tollCurrency }
        : null,
    calc: calc
      ? {
          totalFmt: m.fmt(m.conv(calc.totalEur, "EUR")),
          at: calc.at,
          axles: calc.axles,
          trackKm: calc.trackKm,
          rows: calc.parts.map((p, i) => ({
            key: `${p.country}-${p.method ?? "km"}-${i}`,
            country: p.country,
            method: p.method ?? (p.days ? "vignette" : "km"),
            trips: (p.trips ?? []).map((t) => ({
              label: `${t.from} → ${t.to}`,
              price: `${num(t.price, p.rateCurrency === "EUR" ? 2 : 0)} ${p.rateCurrency}`,
            })),
            name: (p.method === "ramp" ? rampSystem(p.country)?.name : tollKey(p.country)?.name)?.[sr ? "sr" : "en"] ?? p.country,
            km: p.km,
            amountFmt: m.fmt(m.conv(p.eur, "EUR")),
            rate:
              p.method === "ramp"
                ? sr
                  ? `zvanični cenovnik Puteva Srbije${p.category ? `, kategorija ${p.category}` : ""}, od ulazne do izlazne stanice`
                  : `official Putevi Srbije price list${p.category ? `, category ${p.category}` : ""}, entry to exit station`
                : p.days
                  ? sr
                    ? `rovinieta, ${p.days} ${p.days === 1 ? "dan" : "dana"}`
                    : `vignette, ${p.days} day(s)`
                  : `${num(p.km)} km × ${num(p.rate, p.rateCurrency === "EUR" ? 3 : 2)} ${p.rateCurrency}/km`,
            estimated: !!p.estimated,
          })),
          notes: calc.notes ?? [],
          stale: tollStale(tour, calc),
        }
      : null,
  };
  const priceConv = tourPrice(legs, m.conv);
  const profit = priceConv === null ? null : priceConv - costSum;
  const days = tourDays(tour);
  const clash = overlapping(tour, all);
  const liters = costs.fuel.reduce((s, f) => s + f.liters, 0);
  const link = (href: string, label: string | undefined) =>
    label ? (
      <Link href={href} className="hover:text-accent-ink hover:underline">
        {label}
      </Link>
    ) : (
      "—"
    );
  const per = (n: number, unit: string) => `${m.fmt(n)} / ${unit}`;

  return (
    <>
      <PageHeader
        detail
        title={legs.length ? legsRoute(legs) : sr ? "Nova tura" : "New tour"}
        sub={`${fmtDate(tour.dateFrom, locale)}${tour.timeFrom ? ` ${tour.timeFrom}` : ""} – ${tour.dateTo ? `${fmtDate(tour.dateTo, locale)}${tour.timeTo ? ` ${tour.timeTo}` : ""}` : sr ? "u toku" : "on the road"} · ${days} ${sr ? (days === 1 ? "dan" : "dana") : days === 1 ? "day" : "days"}`}
        actions={
          can(ctx.perms, "tours", "edit") ? (
            <RecordActions
              resource="tours"
              record={{ ...tour, legs: legs.map((l) => legView(l, showPrice)) }}
              refs={refs}
              listHref="/tours"
            />
          ) : undefined
        }
      />

      {clash.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-sm text-warn-ink">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {sr
              ? "Ovaj kamion ima i drugu turu u istim danima, pa se isti troškovi računaju na obe: "
              : "This truck has another tour on the same days, so the same costs count for both: "}
            {clash.map((o, i) => (
              <span key={o.id}>
                {i > 0 && ", "}
                <Link
                  href={`/tours/${o.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {routeOf(o.id)} ({fmtDate(o.dateFrom, locale)})
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
              <Kv label={t("f.vehicle")}>
                {tour.vehicleId
                  ? link(`/vehicles/${tour.vehicleId}`, names[tour.vehicleId])
                  : "—"}
              </Kv>
              <Kv label={t("f.trailer")}>
                {tour.trailerId
                  ? link(`/trailers/${tour.trailerId}`, names[tour.trailerId])
                  : "—"}
              </Kv>
              <Kv label={t("f.driver")}>
                {tour.driverId
                  ? link(`/employees/${tour.driverId}`, names[tour.driverId])
                  : "—"}
              </Kv>
              <Kv label={sr ? "Klijenti" : "Clients"}>
                {clientIds.length ? (
                  <span className="flex flex-col items-end gap-0.5">
                    {clientIds.map((c) => (
                      <span key={c}>
                        {link(`/tours?client=${c}`, names[c])}
                      </span>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </Kv>
              <Kv label={sr ? "Pređeno km" : "Distance"}>
                {km ? `${fmtNum(km, locale)} km` : "—"}
              </Kv>
              {showPrice && (
                <Kv label={t("f.tourPrice")}>
                  {priceConv !== null ? m.fmt(priceConv) : "—"}
                </Kv>
              )}
              {tour.notes && <Kv label={t("f.notes")}>{tour.notes}</Kv>}
            </div>
          </Shell>

          {showProfit ? (
            <Shell
              icon={<TrendingUp />}
              title={sr ? "Isplativost" : "Profitability"}
            >
              <div className="px-4 pt-1 pb-4">
                {profit === null ? (
                  <p className="py-2 text-sm text-ink-3">
                    {sr
                      ? "Upiši cenu ture da bi se izračunala zarada."
                      : "Enter the tour price to work out the profit."}
                  </p>
                ) : (
                  <div className="py-2">
                    <div className="text-xs text-ink-3">
                      {sr ? "Zarada na turi" : "Profit on this tour"}
                    </div>
                    <div
                      className={`mt-0.5 text-2xl font-semibold tracking-tight tnum ${profit < 0 ? "text-bad-ink" : "text-good-ink"}`}
                    >
                      {m.fmt(profit)}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {priceConv
                        ? `${Math.round((profit / priceConv) * 100)}% ${sr ? "od cene" : "of the price"}`
                        : ""}
                      {profit < 0 &&
                        (sr
                          ? " · tura je u minusu"
                          : " · this tour lost money")}
                    </div>
                  </div>
                )}
                <div className="mt-2 divide-y divide-line/70">
                  {priceConv !== null && (
                    <Kv label={t("f.tourPrice")}>{m.fmt(priceConv)}</Kv>
                  )}
                  {visible.map((k) => (
                    <Kv key={k} label={t(CAT[k].label)}>
                      <span className="text-ink-2">− {m.fmt(total(k))}</span>
                    </Kv>
                  ))}
                  <Kv label={sr ? "Putarina" : "Tolls"}>
                    <span className="text-ink-2">
                      {toll.source ? `− ${m.fmt(toll.amount)}` : "—"}
                    </span>
                  </Kv>
                  <Kv label={sr ? "Troškovi ukupno" : "Costs in total"}>
                    − {m.fmt(costSum)}
                  </Kv>
                  {profit !== null && km ? (
                    <Kv label={sr ? "Zarada po km" : "Profit per km"}>
                      {per(profit / km, "km")}
                    </Kv>
                  ) : null}
                  {profit !== null && (
                    <Kv label={sr ? "Zarada po danu" : "Profit per day"}>
                      {per(profit / days, sr ? "dan" : "day")}
                    </Kv>
                  )}
                  {km ? (
                    <Kv label={sr ? "Trošak po km" : "Cost per km"}>
                      {per(costSum / km, "km")}
                    </Kv>
                  ) : null}
                </div>
              </div>
            </Shell>
          ) : (
            visible.length > 0 && (
              <Shell
                icon={<Receipt />}
                title={sr ? "Troškovi ture" : "Tour costs"}
              >
                <div className="divide-y divide-line/70 px-4 pb-1.5">
                  {visible.map((k) => (
                    <Kv key={k} label={t(CAT[k].label)}>
                      {m.fmt(total(k))}
                    </Kv>
                  ))}
                  <Kv label={sr ? "Putarina" : "Tolls"}>
                    {toll.source ? m.fmt(toll.amount) : "—"}
                  </Kv>
                </div>
              </Shell>
            )
          )}
          {(showProfit || visible.length > 0) && (
            <Shell icon={<Ticket />} title={sr ? "Putarina" : "Road tolls"}>
              <TollCard
                tourId={tour.id}
                canEdit={can(ctx.perms, "tours", "edit")}
                view={tollView}
                sr={sr}
              />
            </Shell>
          )}
          {liters > 0 && allow("fuel") && km ? (
            <p className="px-1 text-xs text-ink-3">
              {sr ? "Gorivo na turi" : "Fuel on this tour"}:{" "}
              {fmtNum(liters, locale)} l ·{" "}
              {fmtNum((liters / km) * 100, locale, 1)} l/100 km
            </p>
          ) : null}
        </div>

        <DetailTabs
          tabs={[
            {
              key: "legs",
              label: sr ? "Vožnje" : "Legs",
              count: legs.length,
              content: (
                <LegsTable
                  tourId={tour.id}
                  rows={legs.map((l) => ({
                    id: l.id,
                    fromPlace: l.fromPlace,
                    toPlace: l.toPlace,
                    date: l.date,
                    clientId: l.clientId,
                    distanceKm: l.distanceKm,
                    notes: l.notes,
                    ...(showPrice
                      ? { price: l.price, currency: l.currency }
                      : {}),
                  }))}
                  refs={refs}
                  names={names}
                  showPrice={showPrice}
                />
              ),
            },
            allow("fuel") && {
              key: "fuel",
              label: t("x.fuel"),
              count: costs.fuel.length,
              content: (
                <FuelTable
                  rows={costs.fuel}
                  refs={refs}
                  names={names}
                  fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }}
                />
              ),
            },
            allow("payments") && {
              key: "payments",
              label: t("cat.payments"),
              count: costs.payments.length,
              content: (
                <PaymentsTable
                  rows={costs.payments}
                  refs={refs}
                  names={names}
                  fixed={
                    tour.driverId ? { employeeId: tour.driverId } : undefined
                  }
                />
              ),
            },
            allow("services") && {
              key: "services",
              label: t("x.services"),
              count: costs.services.length,
              content: (
                <ServicesTable
                  rows={costs.services}
                  refs={refs}
                  names={names}
                  fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }}
                />
              ),
            },
            allow("parts") && {
              key: "parts",
              label: t("x.parts"),
              count: costs.parts.length,
              content: (
                <PartsTable
                  rows={costs.parts}
                  refs={refs}
                  names={names}
                  fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }}
                />
              ),
            },
            allow("expenses") && {
              key: "expenses",
              label: t("cat.expenses"),
              count: costs.expenses.length,
              content: (
                <ExpensesTable
                  rows={costs.expenses}
                  refs={refs}
                  names={names}
                  fixed={{ vehicleId: tour.vehicleId ?? "", trailerId: "" }}
                />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
