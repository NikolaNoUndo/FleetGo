import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { TrailersTable } from "@/components/tables/assets";
import { getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { trailerRows } from "@/lib/rows";

export const metadata: Metadata = { title: "Prikolice" };

export default async function TrailersPage() {
  const [t, rows, { refs }] = await Promise.all([getT(), trailerRows(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.trailers.title")} sub={t("p.trailers.sub")} />
      <TrailersTable rows={rows} refs={refs} />
    </>
  );
}
