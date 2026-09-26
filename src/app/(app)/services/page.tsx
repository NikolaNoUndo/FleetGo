import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { CostStats } from "@/components/cost-stats";
import { ServicesTable } from "@/components/tables/records";
import { getT } from "@/lib/prefs";
import { getRefs, listServices } from "@/lib/queries";

export const metadata: Metadata = { title: "Servisi" };

export default async function ServicesPage() {
  await requireAccess("services");
  const [t, rows, { refs, names }] = await Promise.all([getT(), listServices(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.services.title")} sub={t("p.services.sub")} tabs={<SectionTabs group="costs" />} />
      <CostStats rows={rows} />
      <ServicesTable rows={rows} refs={refs} names={names} />
    </>
  );
}
