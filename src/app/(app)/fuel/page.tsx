import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { CostStats } from "@/components/cost-stats";
import { FuelTable } from "@/components/tables/records";
import { getT } from "@/lib/prefs";
import { getRefs, listFuel } from "@/lib/queries";

export const metadata: Metadata = { title: "Gorivo" };

export default async function FuelPage() {
  await requireAccess("fuel");
  const [t, rows, { refs, names }] = await Promise.all([getT(), listFuel(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.fuel.title")} sub={t("p.fuel.sub")} tabs={<SectionTabs group="costs" />} />
      <CostStats rows={rows} fuel />
      <FuelTable rows={rows} refs={refs} names={names} />
    </>
  );
}
