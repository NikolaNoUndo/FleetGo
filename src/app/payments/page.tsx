import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { CostStats } from "@/components/cost-stats";
import { PaymentsTable } from "@/components/tables/records";
import { getT } from "@/lib/prefs";
import { getRefs, listPayments } from "@/lib/queries";

export const metadata: Metadata = { title: "Uplate vozačima" };

export default async function PaymentsPage() {
  const [t, rows, { refs, names }] = await Promise.all([getT(), listPayments(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.payments.title")} sub={t("p.payments.sub")} tabs={<SectionTabs group="costs" />} />
      <CostStats rows={rows} payments names={names} />
      <PaymentsTable rows={rows} refs={refs} names={names} />
    </>
  );
}
