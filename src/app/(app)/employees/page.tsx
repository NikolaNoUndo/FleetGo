import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { EmployeesTable } from "@/components/tables/assets";
import { getT } from "@/lib/prefs";
import { getRefs } from "@/lib/queries";
import { employeeRows } from "@/lib/rows";

export const metadata: Metadata = { title: "Zaposleni" };

export default async function EmployeesPage() {
  const ctx = await requireAccess("employees");
  const [t, all, { refs }] = await Promise.all([getT(), employeeRows(), getRefs()]);
  // Payment totals are only sent to members who may see payments.
  const rows = can(ctx.perms, "payments") ? all : all.map((r) => ({ ...r, paidThisMonth: [] }));
  return (
    <>
      <PageHeader title={t("p.employees.title")} sub={t("p.employees.sub")} tabs={<SectionTabs group="fleet" />} />
      <EmployeesTable rows={rows} refs={refs} />
    </>
  );
}
