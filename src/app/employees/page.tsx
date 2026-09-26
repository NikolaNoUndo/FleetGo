import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { EmployeesTable } from "@/components/tables/assets";
import { getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { employeeRows } from "@/lib/rows";

export const metadata: Metadata = { title: "Zaposleni" };

export default async function EmployeesPage() {
  const [t, rows, { refs }] = await Promise.all([getT(), employeeRows(), getRefs()]);
  return (
    <>
      <PageHeader title={t("p.employees.title")} sub={t("p.employees.sub")} />
      <EmployeesTable rows={rows} refs={refs} />
    </>
  );
}
