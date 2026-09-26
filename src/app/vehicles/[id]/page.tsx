import { notFound } from "next/navigation";
import { Gauge, Info, ShieldCheck } from "lucide-react";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { Crumbs, DocsMeter } from "@/components/entity-parts";
import { DetailTabs, RecordActions } from "@/components/detail";
import { AssetStatus } from "@/components/tables/common";
import { DocumentsTable, FuelTable, PartsTable, ServicesTable } from "@/components/tables/records";
import { getPrefs, getT } from "@/lib/prefs";
import { consumptionByVehicle, documentsWithOwner, getRefs, getVehicle, listEmployees, listFuel, listParts, listServices, listTrailers } from "@/lib/queries";
import { getMoney } from "@/lib/money-server";
import { EURO_NORMS, VEHICLE_TYPES, optLabel } from "@/lib/catalog";
import { fmtNum } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/vehicles/[id]">) {
  const { id } = await props.params;
  const v = await getVehicle(id).catch(() => null);
  return { title: v?.plate ?? "Vozilo" };
}

export default async function VehiclePage(props: PageProps<"/vehicles/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await getVehicle(id);
  if (!v) notFound();

  const [t, { locale }, m, { refs, names }, docs, services, fuel, parts, trailers, employees] = await Promise.all([
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
  ]);
  const vServices = services.filter((s) => s.vehicleId === id);
  const vFuel = fuel.filter((f) => f.vehicleId === id);
  const vParts = parts.filter((p) => p.vehicleId === id);
  const trailer = trailers.find((tr) => tr.vehicleId === id);
  const driver = employees.find((e) => e.id === v.driverId);
  const cons = consumptionByVehicle(vFuel)[id];

  return (
    <>
      <PageHeader
        crumbs={<Crumbs href="/vehicles" label={t("nav.vehicles")} current={v.plate} />}
        title={v.plate}
        sub={[v.brand, v.model, v.year].filter(Boolean).join(" · ")}
        actions={<RecordActions resource="vehicles" record={v} refs={refs} listHref="/vehicles" />}
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Shell icon={<Info />} title={t("c.details")}>
            <div className="divide-y divide-line/70 px-5 py-1.5">
              <Kv label={t("f.status")}>
                <AssetStatus status={v.status} />
              </Kv>
              <Kv label={t("f.type")}>{optLabel(VEHICLE_TYPES, v.type, locale)}</Kv>
              <Kv label={t("f.driver")}>{driver ? `${driver.firstName} ${driver.lastName}` : "—"}</Kv>
              <Kv label={t("x.coupledTrailer")}>{trailer?.plate ?? "—"}</Kv>
              <Kv label={t("f.odometerKm")}>{v.odometerKm ? `${fmtNum(v.odometerKm, locale)} km` : "—"}</Kv>
              <Kv label={t("f.euroNorm")}>{optLabel(EURO_NORMS, v.euroNorm, locale) || "—"}</Kv>
              <Kv label={t("f.vin")}>
                <span className="font-mono text-[12.5px]">{v.vin ?? "—"}</span>
              </Kv>
              <Kv label={t("f.wialonUnitId")}>{v.wialonUnitId ?? "—"}</Kv>
            </div>
          </Shell>

          <Shell icon={<ShieldCheck />} title={t("x.docsStatus")}>
            <DocsMeter docs={docs} warnDays={m.warnDays} locale={locale} />
          </Shell>

          <Shell icon={<Gauge />} title={t("x.costs")}>
            <div className="divide-y divide-line/70 px-5 py-1.5">
              <Kv label={t("cat.fuel")}>{m.fmt(m.sum(vFuel))}</Kv>
              <Kv label={t("cat.services")}>{m.fmt(m.sum(vServices))}</Kv>
              <Kv label={t("cat.parts")}>{m.fmt(m.sum(vParts))}</Kv>
              <Kv label={t("f.consumption")}>{cons ? `${fmtNum(cons.l100, locale, 1)} l/100 km` : "—"}</Kv>
            </div>
          </Shell>
        </div>

        <DetailTabs
          tabs={[
            { key: "docs", label: t("x.documents"), count: docs.length, content: <DocumentsTable rows={docs} refs={refs} fixed={{ entityType: "vehicle", entityId: id }} hide={["owner", "issued"]} /> },
            { key: "services", label: t("x.services"), count: vServices.length, content: <ServicesTable rows={vServices} refs={refs} names={names} fixed={{ vehicleId: id, trailerId: "" }} hide={["for"]} /> },
            { key: "fuel", label: t("x.fuel"), count: vFuel.length, content: <FuelTable rows={vFuel} refs={refs} names={names} fixed={{ vehicleId: id }} hide={["vehicle"]} /> },
            { key: "parts", label: t("x.parts"), count: vParts.length, content: <PartsTable rows={vParts} refs={refs} names={names} fixed={{ vehicleId: id, trailerId: "" }} hide={["for"]} /> },
          ]}
        />
      </div>
    </>
  );
}
