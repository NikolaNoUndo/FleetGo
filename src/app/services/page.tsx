import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { CostStats } from "@/components/cost-stats";
import { ServicesTable } from "@/components/tables/records";
import { getT } from "@/lib/prefs";
import { getRefs, listServices } from "@/lib/queries";

export const metadata: Metadata = { title: "Servisi" };

export default async function ServicesPage() {
  const [t, rows, { refs, names }] = await Promise.all([getT(), listServices(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.services.title")} sub={t("p.services.sub")} />
      <CostStats rows={rows} />
      <ServicesTable rows={rows} refs={refs} names={names} />
    </>
  );
}
