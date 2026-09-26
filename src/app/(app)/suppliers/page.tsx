import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { SuppliersTable } from "@/components/tables/suppliers";
import { getT } from "@/lib/prefs";
import { requireContext } from "@/lib/auth/context";
import { can, canSuppliers } from "@/lib/auth/permissions";
import { getRefs, listParts, listServices, listSuppliers } from "@/lib/queries";
import { getMoney } from "@/lib/money-server";

export const metadata: Metadata = { title: "Dobavljači" };

export default async function SuppliersPage() {
  const ctx = await requireContext();
  if (!canSuppliers(ctx.perms)) redirect("/no-access");
  const [t, suppliers, { refs }, m] = await Promise.all([getT(), listSuppliers(), getRefs(), getMoney()]);
  const parts = can(ctx.perms, "parts") ? await listParts() : [];
  const services = can(ctx.perms, "services") ? await listServices() : [];
  const rows = suppliers.map((s) => {
    const p = parts.filter((x) => x.supplierId === s.id);
    const v = services.filter((x) => x.supplierId === s.id);
    const dates = [...p, ...v].map((x) => x.date).sort();
    return { id: s.id, name: s.name, phone: s.phone, note: s.note, parts: p.length, services: v.length, spent: m.sum(p) + m.sum(v), lastDate: dates.at(-1) ?? null };
  });
  const sr = m.locale === "sr";
  return (
    <>
      <PageHeader
        title={t("nav.suppliers")}
        sub={sr ? "Dobavljači delova i servisi. Novi se dodaju i direktno iz unosa dela ili servisa." : "Parts suppliers and workshops. New ones can also be added straight from a part or service entry."}
        tabs={<SectionTabs group="costs" />}
      />
      <SuppliersTable rows={rows} refs={refs} />
    </>
  );
}
