import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import { Info, ShieldCheck, Wallet } from "lucide-react";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { DocsMeter } from "@/components/entity-parts";
import { DetailTabs, RecordActions } from "@/components/detail";
import { EmployeeStatus } from "@/components/tables/common";
import { DocumentsTable, FuelTable, PaymentsTable } from "@/components/tables/records";
import { getPrefs, getT } from "@/lib/prefs";
import { documentsWithOwner, getEmployee, getRefs, listFuel, listPayments, listVehicles } from "@/lib/queries";
import { getMoney, inMonth } from "@/lib/money-server";
import { EMPLOYEE_ROLES, optLabel } from "@/lib/catalog";
import { fmtDate } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/employees/[id]">) {
  const { id } = await props.params;
  const e = await getEmployee(id).catch(() => null);
  return { title: e ? `${e.firstName} ${e.lastName}` : "Zaposleni" };
}

export default async function EmployeePage(props: PageProps<"/employees/[id]">) {
  const ctx = await requireAccess("employees");
  const allow = (m: Parameters<typeof can>[1]) => can(ctx.perms, m);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEmployee(id);
  if (!e) notFound();

  const [t, { locale }, m, { refs, names }, docs, payments, fuel, vehicles] = await Promise.all([
    getT(),
    getPrefs(),
    getMoney(),
    getRefs(),
    documentsWithOwner({ entityType: "employee", entityId: id }),
    listPayments(),
    listFuel(),
    listVehicles(),
  ]);
  const pays = payments.filter((p) => p.employeeId === id);
  const eFuel = fuel.filter((f) => f.employeeId === id);
  const vehicle = vehicles.find((v) => v.driverId === id) ?? vehicles.find((v) => v.extraDriverIds.includes(id));
  const name = `${e.firstName} ${e.lastName}`;
  const isDriver = e.role === "driver";

  return (
    <>
      <PageHeader
        title={name}
        sub={[optLabel(EMPLOYEE_ROLES, e.role, locale), e.phone].filter(Boolean).join(" · ")}
        actions={can(ctx.perms, "employees", "edit") ? <RecordActions resource="employees" record={e} refs={refs} listHref="/employees" /> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Shell icon={<Info />} title={t("c.details")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label={t("f.status")}>
                <EmployeeStatus status={e.status} />
              </Kv>
              <Kv label={t("f.role")}>{optLabel(EMPLOYEE_ROLES, e.role, locale)}</Kv>
              <Kv label={t("f.phone")}>{e.phone ? <a href={`tel:${e.phone.replace(/\s/g, "")}`} className="text-accent hover:underline">{e.phone}</a> : "—"}</Kv>
              <Kv label={t("f.email")}>{e.email ? <span className="break-all">{e.email}</span> : "—"}</Kv>
              <Kv label={t("f.hiredAt")}>{fmtDate(e.hiredAt, locale)}</Kv>
              <Kv label={t("x.assignedVehicle")}>
                {vehicle ? (
                  <Link href={`/vehicles/${vehicle.id}`} className="text-accent hover:underline">
                    {vehicle.plate}
                  </Link>
                ) : (
                  "—"
                )}
              </Kv>
            </div>
          </Shell>
          {allow("documents") && (
            <Shell icon={<ShieldCheck />} title={t("x.docsStatus")}>
              <DocsMeter docs={docs} warnDays={m.warnDays} locale={locale} />
            </Shell>
          )}
          {allow("payments") && <Shell icon={<Wallet />} title={t("x.payments")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label={t("c.thisMonth")}>{m.fmt(m.sum(pays.filter((p) => inMonth(p.date, 0))))}</Kv>
              <Kv label={locale === "sr" ? "Prošli mesec" : "Last month"}>{m.fmt(m.sum(pays.filter((p) => inMonth(p.date, -1))))}</Kv>
              <Kv label={locale === "sr" ? "Ova godina" : "This year"}>{m.fmt(m.sum(pays.filter((p) => p.date.startsWith(String(new Date().getFullYear())))))}</Kv>
            </div>
          </Shell>}
        </div>
        <DetailTabs
          tabs={[
            allow("documents") && { key: "docs", label: t("x.documents"), count: docs.length, content: <DocumentsTable rows={docs} refs={refs} fixed={{ entityType: "employee", entityId: id }} hide={["owner", "issued"]} /> },
            allow("payments") && { key: "payments", label: t("x.payments"), count: pays.length, content: <PaymentsTable rows={pays} refs={refs} names={names} fixed={{ employeeId: id }} hide={["employee"]} /> },
            ...(isDriver || eFuel.length
              ? [allow("fuel") && { key: "fuel", label: t("x.fuel"), count: eFuel.length, content: <FuelTable rows={eFuel} refs={refs} names={names} fixed={{ employeeId: id }} hide={["driver"]} /> }]
              : []),
          ]}
        />
      </div>
    </>
  );
}
