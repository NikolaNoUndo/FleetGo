import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { Gauge, Info, ShieldCheck } from "lucide-react";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { DocsMeter } from "@/components/entity-parts";
import { DetailTabs, RecordActions } from "@/components/detail";
import { AssetStatus } from "@/components/tables/common";
import { DocumentsTable, FuelTable, PartsTable, ServicesTable } from "@/components/tables/records";
import { getPrefs, getT } from "@/lib/prefs";
import { consumptionByVehicle, documentsWithOwner, getRefs, getVehicle, listEmployees, listExpenses, listFuel, listParts, listServices, listTrailers, listVehicleTrailers } from "@/lib/queries";
import { ExpensesTable } from "@/components/tables/expenses";
import { getMoney } from "@/lib/money-server";
import { EURO_NORMS, VEHICLE_TYPES, optLabel } from "@/lib/catalog";
import { fmtNum } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/vehicles/[id]">) {
  const { id } = await props.params;
  const v = await getVehicle(id).catch(() => null);
  return { title: v?.plate ?? "Vozilo" };
}

export default async function VehiclePage(props: PageProps<"/vehicles/[id]">) {
  const ctx = await requireAccess("vehicles");
  const allow = (m: Parameters<typeof can>[1]) => can(ctx.perms, m);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await getVehicle(id);
  if (!v) notFound();

  const [t, { locale }, m, { refs, names }, docs, services, fuel, parts, trailers, employees, links, expenses] = await Promise.all([
    getT(),
    getPrefs(),
    getMoney(),
    getRefs(),
    documentsWithOwner({ entityType: "vehicle", entityId: id }),
    listServices(),
    listFuel(),
    listParts(),
    listTrailers(),
    listEmployees(),
    listVehicleTrailers(),
    allow("expenses") ? listExpenses() : Promise.resolve([]),
  ]);
  const vExpenses = expenses.filter((e) => e.vehicleId === id);
  const vServices = services.filter((s) => s.vehicleId === id);
  const vFuel = fuel.filter((f) => f.vehicleId === id);
  const vParts = parts.filter((p) => p.vehicleId === id);
  const linked = links.filter((l) => l.vehicleId === id).map((l) => trailers.find((tr) => tr.id === l.trailerId)).filter((tr): tr is (typeof trailers)[number] => !!tr).sort((a, b) => a.plate.localeCompare(b.plate));
  const driver = employees.find((e) => e.id === v.driverId);
  const extraDrivers = v.extraDriverIds.map((x) => employees.find((e) => e.id === x)).filter((e): e is (typeof employees)[number] => !!e);
  const person = (e: (typeof employees)[number]) => (
    <Link key={e.id} href={`/employees/${e.id}`} className="hover:text-accent-ink hover:underline">
      {e.firstName} {e.lastName}
    </Link>
  );
  const cons = consumptionByVehicle(vFuel)[id];

  return (
    <>
      <PageHeader
        title={v.plate}
        sub={[v.brand, v.model, v.year].filter(Boolean).join(" · ")}
        actions={can(ctx.perms, "vehicles", "edit") ? <RecordActions resource="vehicles" record={{ ...v, trailerIds: linked.map((tr) => tr.id).join(",") }} refs={refs} listHref="/vehicles" /> : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Shell icon={<Info />} title={t("c.details")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label={t("f.status")}>
                <AssetStatus status={v.status} />
              </Kv>
              <Kv label={t("f.type")}>{optLabel(VEHICLE_TYPES, v.type, locale)}</Kv>
              <Kv label={extraDrivers.length ? t("f.mainDriver") : t("f.driver")}>{driver ? person(driver) : "—"}</Kv>
              {extraDrivers.length > 0 && (
                <Kv label={locale === "sr" ? "Ostali vozači" : "Other drivers"}>
                  <span className="flex flex-col items-end gap-0.5">{extraDrivers.map(person)}</span>
                </Kv>
              )}
              <Kv label={t("f.trailersLinked")}>
                {linked.length ? (
                  <span className="flex flex-col items-end gap-0.5">
                    {linked.map((tr) => (
                      <Link key={tr.id} href={`/trailers/${tr.id}`} className="hover:text-accent-ink hover:underline">
                        {tr.plate}
                      </Link>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </Kv>
              <Kv label={t("f.odometerKm")}>{v.odometerKm ? `${fmtNum(v.odometerKm, locale)} km` : "—"}</Kv>
              <Kv label={t("f.euroNorm")}>{optLabel(EURO_NORMS, v.euroNorm, locale) || "—"}</Kv>
              <Kv label={t("f.vin")}>
                <span className="font-mono text-xs">{v.vin ?? "—"}</span>
              </Kv>
              <Kv label={t("f.wialonUnitId")}>{v.wialonUnitId ?? "—"}</Kv>
            </div>
          </Shell>

          {allow("documents") && (
            <Shell icon={<ShieldCheck />} title={t("x.docsStatus")}>
              <DocsMeter docs={docs} warnDays={m.warnDays} locale={locale} />
            </Shell>
          )}

          <Shell icon={<Gauge />} title={t("x.costs")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              {allow("fuel") && <Kv label={t("cat.fuel")}>{m.fmt(m.sum(vFuel))}</Kv>}
              {allow("services") && <Kv label={t("cat.services")}>{m.fmt(m.sum(vServices))}</Kv>}
              {allow("parts") && <Kv label={t("cat.parts")}>{m.fmt(m.sum(vParts))}</Kv>}
              {allow("expenses") && vExpenses.length > 0 && <Kv label={t("cat.expenses")}>{m.fmt(m.sum(vExpenses))}</Kv>}
              <Kv label={t("f.consumption")}>{cons ? `${fmtNum(cons.l100, locale, 1)} l/100 km` : "—"}</Kv>
            </div>
          </Shell>
        </div>

        <DetailTabs
          tabs={[
            allow("documents") && { key: "docs", label: t("x.documents"), count: docs.length, content: <DocumentsTable rows={docs} refs={refs} fixed={{ entityType: "vehicle", entityId: id }} hide={["owner", "issued"]} /> },
            allow("services") && { key: "services", label: t("x.services"), count: vServices.length, content: <ServicesTable rows={vServices} refs={refs} names={names} fixed={{ vehicleId: id, trailerId: "" }} hide={["for"]} /> },
            allow("fuel") && { key: "fuel", label: t("x.fuel"), count: vFuel.length, content: <FuelTable rows={vFuel} refs={refs} names={names} fixed={{ vehicleId: id }} hide={["vehicle"]} /> },
            allow("parts") && { key: "parts", label: t("x.parts"), count: vParts.length, content: <PartsTable rows={vParts} refs={refs} names={names} fixed={{ vehicleId: id, trailerId: "" }} hide={["for"]} /> },
            allow("expenses") && { key: "expenses", label: t("cat.expenses"), count: vExpenses.length, content: <ExpensesTable rows={vExpenses} refs={refs} names={names} fixed={{ vehicleId: id, trailerId: "" }} hide={["for"]} /> },
          ]}
        />
      </div>
    </>
  );
}
