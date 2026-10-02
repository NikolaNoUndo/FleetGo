import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { ClientsTable } from "@/components/tables/tours";
import { getT } from "@/lib/prefs";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getRefs } from "@/lib/queries";
import { listClients, toursFor } from "@/lib/tours";
import { getMoney } from "@/lib/money-server";

export const metadata: Metadata = { title: "Klijenti" };

export default async function ClientsPage() {
  const ctx = await requireAccess("tours");
  const [t, m, { refs }, clients] = await Promise.all([getT(), getMoney(), getRefs(), listClients()]);
  const showPrice = can(ctx.perms, "tourPrice");
  const showProfit = can(ctx.perms, "profit");
  const tours = await toursFor(ctx.perms, m.conv);
  const rows = clients.map((c) => {
    const own = tours.filter((x) => x.clientId === c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      note: c.note,
      tours: own.length,
      lastDate: own.map((x) => x.dateFrom).sort().at(-1) ?? null,
      ...(showPrice ? { revenue: own.reduce((s, x) => s + m.conv(x.price ?? 0, x.currency ?? "EUR"), 0) } : {}),
      ...(showProfit ? { profit: own.reduce((s, x) => s + (x.profit ?? 0), 0) } : {}),
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
