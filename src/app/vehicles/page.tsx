import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { VehiclesTable } from "@/components/tables/assets";
import { getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { vehicleRows } from "@/lib/rows";

export const metadata: Metadata = { title: "Vozila" };

export default async function VehiclesPage() {
  const [t, rows, { refs }] = await Promise.all([getT(), vehicleRows(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.vehicles.title")} sub={t("p.vehicles.sub")} />
      <VehiclesTable rows={rows} refs={refs} />
    </>
  );
}
