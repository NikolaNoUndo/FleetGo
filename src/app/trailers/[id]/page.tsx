import { notFound } from "next/navigation";
import Link from "next/link";
import { Gauge, Info, ShieldCheck } from "lucide-react";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { Crumbs, DocsMeter } from "@/components/entity-parts";
import { DetailTabs, RecordActions } from "@/components/detail";
import { AssetStatus } from "@/components/tables/common";
import { DocumentsTable, PartsTable, ServicesTable } from "@/components/tables/records";
import { getPrefs, getT } from "@/lib/prefs";
import { documentsWithOwner, getRefs, getTrailer, listParts, listServices } from "@/lib/queries";
import { getMoney } from "@/lib/money-server";
import { TRAILER_TYPES, optLabel } from "@/lib/catalog";
import { fmtNum } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/trailers/[id]">) {
  const { id } = await props.params;
  const v = await getTrailer(id).catch(() => null);
  return { title: v?.plate ?? "Prikolica" };
}

export default async function TrailerPage(props: PageProps<"/trailers/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tr = await getTrailer(id);
  if (!tr) notFound();

  const [t, { locale }, m, { refs, names }, docs, services, parts] = await Promise.all([
    getT(),
    getPrefs(),
    getMoney(),
    getRefs(),
    documentsWithOwner({ entityType: "trailer", entityId: id }),
    listServices(),
    listParts(),
  ]);
  const tServices = services.filter((s) => s.trailerId === id);
  const tParts = parts.filter((p) => p.trailerId === id);

  return (
    <>
      <PageHeader
        crumbs={<Crumbs href="/trailers" label={t("nav.trailers")} current={tr.plate} />}
        title={tr.plate}
        sub={[optLabel(TRAILER_TYPES, tr.type, locale), tr.brand, tr.year].filter(Boolean).join(" · ")}
        actions={<RecordActions resource="trailers" record={tr} refs={refs} listHref="/trailers" />}
      />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Shell icon={<Info />} title={t("c.details")}>
            <div className="divide-y divide-line/70 px-5 py-1.5">
              <Kv label={t("f.status")}>
                <AssetStatus status={tr.status} />
              </Kv>
              <Kv label={t("f.type")}>{optLabel(TRAILER_TYPES, tr.type, locale)}</Kv>
              <Kv label={t("x.coupledTo")}>
                {tr.vehicleId ? (
                  <Link className="text-accent hover:underline" href={`/vehicles/${tr.vehicleId}`}>
                    {names[tr.vehicleId]}
                  </Link>
                ) : (
                  "—"
                )}
              </Kv>
              <Kv label={t("f.axles")}>{tr.axles ?? "—"}</Kv>
              <Kv label={t("f.capacityKg")}>{tr.capacityKg ? `${fmtNum(tr.capacityKg, locale)} kg` : "—"}</Kv>
              <Kv label={t("f.vin")}>
                <span className="font-mono text-[12.5px]">{tr.vin ?? "—"}</span>
              </Kv>
            </div>
          </Shell>
          <Shell icon={<ShieldCheck />} title={t("x.docsStatus")}>
            <DocsMeter docs={docs} warnDays={m.warnDays} locale={locale} />
          </Shell>
          <Shell icon={<Gauge />} title={t("x.costs")}>
            <div className="divide-y divide-line/70 px-5 py-1.5">
              <Kv label={t("cat.services")}>{m.fmt(m.sum(tServices))}</Kv>
              <Kv label={t("cat.parts")}>{m.fmt(m.sum(tParts))}</Kv>
            </div>
          </Shell>
        </div>
        <DetailTabs
          tabs={[
            { key: "docs", label: t("x.documents"), count: docs.length, content: <DocumentsTable rows={docs} refs={refs} fixed={{ entityType: "trailer", entityId: id }} hide={["owner", "issued"]} /> },
            { key: "services", label: t("x.services"), count: tServices.length, content: <ServicesTable rows={tServices} refs={refs} names={names} fixed={{ trailerId: id, vehicleId: "" }} hide={["for"]} /> },
            { key: "parts", label: t("x.parts"), count: tParts.length, content: <PartsTable rows={tParts} refs={refs} names={names} fixed={{ trailerId: id, vehicleId: "" }} hide={["for"]} /> },
          ]}
        />
      </div>
    </>
  );
}
