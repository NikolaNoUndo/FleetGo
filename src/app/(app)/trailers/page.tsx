import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { TrailersTable } from "@/components/tables/assets";
import { getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { trailerRows } from "@/lib/rows";

export const metadata: Metadata = { title: "Prikolice" };

export default async function TrailersPage() {
  await requireAccess("trailers");
  const [t, rows, { refs }] = await Promise.all([getT(), trailerRows(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.trailers.title")} sub={t("p.trailers.sub")} tabs={<SectionTabs group="fleet" />} />
      <TrailersTable rows={rows} refs={refs} />
    </>
  );
}
