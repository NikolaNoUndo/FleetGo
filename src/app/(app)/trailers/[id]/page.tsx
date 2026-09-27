import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import Link from "@/components/ui/link";
import { Gauge, Info, ShieldCheck } from "lucide-react";
import { Kv, PageHeader, Shell } from "@/components/ui/primitives";
import { DocsMeter } from "@/components/entity-parts";
import { DetailTabs, RecordActions } from "@/components/detail";
import { AssetStatus } from "@/components/tables/common";
import { DocumentsTable, PartsTable, ServicesTable } from "@/components/tables/records";
import { getPrefs, getT } from "@/lib/prefs";
import { documentsWithOwner, getRefs, getTrailer, listParts, listServices, listVehicleTrailers } from "@/lib/queries";
import { getMoney } from "@/lib/money-server";
import { TRAILER_TYPES, optLabel } from "@/lib/catalog";
import { fmtNum } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/trailers/[id]">) {
  const { id } = await props.params;
  const v = await getTrailer(id).catch(() => null);
  return { title: v?.plate ?? "Prikolica" };
}

export default async function TrailerPage(props: PageProps<"/trailers/[id]">) {
  const ctx = await requireAccess("trailers");
  const allow = (m: Parameters<typeof can>[1]) => can(ctx.perms, m);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tr = await getTrailer(id);
  if (!tr) notFound();

  const [t, { locale }, m, { refs, names }, docs, services, parts, links] = await Promise.all([
    getT(),
    getPrefs(),
    getMoney(),
    getRefs(),
    documentsWithOwner({ entityType: "trailer", entityId: id }),
    listServices(),
    listParts(),
    listVehicleTrailers(),
  ]);
  const vehicleIds = links.filter((l) => l.trailerId === id).map((l) => l.vehicleId).sort((a, b) => (names[a] ?? "").localeCompare(names[b] ?? ""));
  const tServices = services.filter((s) => s.trailerId === id);
  const tParts = parts.filter((p) => p.trailerId === id);

  return (
    <>
      <PageHeader
        title={tr.plate}
        sub={[optLabel(TRAILER_TYPES, tr.type, locale), tr.brand, tr.year].filter(Boolean).join(" · ")}
        actions={can(ctx.perms, "trailers", "edit") ? <RecordActions resource="trailers" record={{ ...tr, vehicleIds: vehicleIds.join(",") }} refs={refs} listHref="/trailers" /> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Shell icon={<Info />} title={t("c.details")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              <Kv label={t("f.status")}>
                <AssetStatus status={tr.status} />
              </Kv>
              <Kv label={t("f.type")}>{optLabel(TRAILER_TYPES, tr.type, locale)}</Kv>
              <Kv label={t("f.vehiclesLinked")}>
                {vehicleIds.length ? (
                  <span className="flex flex-col items-end gap-0.5">
                    {vehicleIds.map((vid) => (
                      <Link key={vid} className="text-accent hover:underline" href={`/vehicles/${vid}`}>
                        {names[vid]}
                      </Link>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </Kv>
              <Kv label={t("f.axles")}>{tr.axles ?? "—"}</Kv>
              <Kv label={t("f.capacityKg")}>{tr.capacityKg ? `${fmtNum(tr.capacityKg, locale)} kg` : "—"}</Kv>
              <Kv label={t("f.vin")}>
                <span className="font-mono text-xs">{tr.vin ?? "—"}</span>
              </Kv>
            </div>
          </Shell>
          {allow("documents") && (
            <Shell icon={<ShieldCheck />} title={t("x.docsStatus")}>
              <DocsMeter docs={docs} warnDays={m.warnDays} locale={locale} />
            </Shell>
          )}
          <Shell icon={<Gauge />} title={t("x.costs")}>
            <div className="divide-y divide-line/70 px-4 pb-1.5">
              {allow("services") && <Kv label={t("cat.services")}>{m.fmt(m.sum(tServices))}</Kv>}
              {allow("parts") && <Kv label={t("cat.parts")}>{m.fmt(m.sum(tParts))}</Kv>}
            </div>
          </Shell>
        </div>
        <DetailTabs
          tabs={[
            allow("documents") && { key: "docs", label: t("x.documents"), count: docs.length, content: <DocumentsTable rows={docs} refs={refs} fixed={{ entityType: "trailer", entityId: id }} hide={["owner", "issued"]} /> },
            allow("services") && { key: "services", label: t("x.services"), count: tServices.length, content: <ServicesTable rows={tServices} refs={refs} names={names} fixed={{ trailerId: id, vehicleId: "" }} hide={["for"]} /> },
            allow("parts") && { key: "parts", label: t("x.parts"), count: tParts.length, content: <PartsTable rows={tParts} refs={refs} names={names} fixed={{ trailerId: id, vehicleId: "" }} hide={["for"]} /> },
          ]}
        />
      </div>
    </>
  );
}
