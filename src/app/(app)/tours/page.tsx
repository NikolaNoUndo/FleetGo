import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { KpiCard } from "@/components/stat";
import { ToursTable } from "@/components/tables/tours";
import { getT } from "@/lib/prefs";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getRefs } from "@/lib/queries";
import { listTours, toursFor } from "@/lib/tours";
import { getMoney, inMonth } from "@/lib/money-server";

export const metadata: Metadata = { title: "Ture" };

export default async function ToursPage(props: PageProps<"/tours">) {
  const ctx = await requireAccess("tours");
  const sp = await props.searchParams;
  const clientId = typeof sp.client === "string" ? sp.client : null;
  const [t, m, { refs, names }, tours] = await Promise.all([getT(), getMoney(), getRefs(), listTours()]);
  const showPrice = can(ctx.perms, "tourPrice");
  const showProfit = can(ctx.perms, "profit");
  const all = await toursFor(ctx.perms, m.conv, tours);
  const rows = clientId ? all.filter((x) => x.clientIds.includes(clientId)) : all;
  const sr = m.locale === "sr";

  // this month's tours (by start date) for the owner's summary
  const month = rows.filter((r) => inMonth(r.dateFrom));
  const priced = month.filter((r) => r.price !== null && r.price !== undefined);
  const revenue = priced.reduce((s, r) => s + (r.price ?? 0), 0);
  const costs = month.reduce((s, r) => s + (r.costs ?? 0), 0);
  const profit = priced.reduce((s, r) => s + (r.profit ?? 0), 0);
  const km = month.reduce((s, r) => s + (r.distanceKm ?? 0), 0);

  return (
    <>
      <PageHeader
        title={clientId && names[clientId] ? `${t("nav.tours")} · ${names[clientId]}` : t("nav.tours")}
        sub={sr ? "Troškovi kamiona i vozača u periodu ture sami se računaju na turu." : "The truck's and driver's costs within a tour's dates count for that tour."}
        tabs={<SectionTabs group="tours" />}
      />
      {showProfit && (
        <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label={sr ? "Tura ovog meseca" : "Tours this month"} value={month.length} sub={sr ? `${month.filter((r) => !r.dateTo).length} u toku` : `${month.filter((r) => !r.dateTo).length} on the road`} />
          <KpiCard label={sr ? "Prihod ovog meseca" : "Revenue this month"} value={m.fmt(revenue)} sub={sr ? `${priced.length} sa cenom` : `${priced.length} priced`} />
          <KpiCard label={sr ? "Troškovi tura" : "Tour costs"} value={m.fmt(costs)} sub={km ? `${(costs / km).toFixed(2)} ${m.currency === "EUR" ? "€" : "RSD"}/km` : undefined} />
          <KpiCard label={sr ? "Zarada ovog meseca" : "Profit this month"} value={<span className={profit < 0 ? "text-bad-ink" : undefined}>{m.fmt(profit)}</span>} sub={revenue ? `${Math.round((profit / revenue) * 100)}% ${sr ? "od prihoda" : "of revenue"}` : undefined} />
        </div>
      )}
      <ToursTable rows={rows} refs={refs} names={names} showPrice={showPrice} showProfit={showProfit} />
    </>
  );
}
