import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { ClientsTable } from "@/components/tables/tours";
import { getT } from "@/lib/prefs";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getRefs } from "@/lib/queries";
import { listClients, listLegs, toursFor } from "@/lib/tours";
import { getMoney } from "@/lib/money-server";

export const metadata: Metadata = { title: "Klijenti" };

export default async function ClientsPage() {
  const ctx = await requireAccess("tours");
  const [t, m, { refs }, clients] = await Promise.all([getT(), getMoney(), getRefs(), listClients()]);
  const showPrice = can(ctx.perms, "tourPrice");
  const showProfit = can(ctx.perms, "profit");
  const [tours, legs] = await Promise.all([toursFor(ctx.perms, m.conv), listLegs()]);
  const tourById = new Map(tours.map((x) => [x.id, x]));
  const rows = clients.map((c) => {
    const own = legs.filter((l) => l.clientId === c.id);
    const tourIds = [...new Set(own.map((l) => l.tourId))];
    const revenue = own.reduce((s, l) => s + m.conv(l.price, l.currency), 0);
    // a tour's profit is shared among its legs by their price
    const profit = own.reduce((s, l) => {
      const tr = tourById.get(l.tourId);
      if (!tr?.price || tr.profit === null || tr.profit === undefined || l.price === null) return s;
      return s + tr.profit * (m.conv(l.price, l.currency) / tr.price);
    }, 0);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      note: c.note,
      tours: tourIds.length,
      lastDate: tourIds.map((id) => tourById.get(id)?.dateFrom ?? "").sort().at(-1) || null,
      ...(showPrice ? { revenue } : {}),
      ...(showProfit ? { profit } : {}),
    };
  });
  const sr = m.locale === "sr";
  return (
    <>
      <PageHeader
        title={t("nav.clients")}
        sub={sr ? "Za koga voziš. Novi klijent se dodaje i sam, kad ga upišeš na turi." : "Who you drive for. A new client is also added when you type it on a tour."}
        tabs={<SectionTabs group="tours" />}
      />
      <ClientsTable rows={rows} refs={refs} showPrice={showPrice} showProfit={showProfit} />
    </>
  );
}
