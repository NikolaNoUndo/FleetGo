import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { CostStats } from "@/components/cost-stats";
import { PartsTable } from "@/components/tables/records";
import { getT } from "@/lib/prefs";
import { getRefs, listParts } from "@/lib/queries";

export const metadata: Metadata = { title: "Delovi i nabavka" };

export default async function PartsPage() {
  const [t, rows, { refs, names }] = await Promise.all([getT(), listParts(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.parts.title")} sub={t("p.parts.sub")} />
      <CostStats rows={rows} />
      <PartsTable rows={rows} refs={refs} names={names} />
    </>
  );
}
