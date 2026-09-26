import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowUpRight, Map as MapIcon } from "lucide-react";
import { Dot, PageHeader, Shell } from "@/components/ui/primitives";
import { ExpiryBadge } from "@/components/ui/client";
import { KpiCard } from "@/components/stat";
import { CostChart, type MonthCosts } from "@/components/charts/cost-chart";
import { Distribution, StatusColumns } from "@/components/distribution";
import { HBars } from "@/components/hbars";
import { LiveMini } from "@/components/map/live-view";
import { getPrefs, getT } from "@/lib/prefs";
import { consumptionByVehicle, documentsWithOwner, listEmployees, listFuel, listParts, listPayments, listServices, listTrailers, listVehicles } from "@/lib/queries";
import { getMoney, inMonth, monthBounds, pctDelta } from "@/lib/money-server";
import { DOC_TYPES, ENTITY_TYPES, type EntityType, optLabel } from "@/lib/catalog";
import { daysUntil, expiryState, fmtDate, fmtNum } from "@/lib/format";
import { getPositions } from "@/lib/telematics";
import { db, schema } from "@/db";
import { getCompanyId } from "@/lib/tenant";

export default async function OverviewPage() {
  const [t, { locale }, m, vehicles, trailers, employees, fuel, services, parts, payments, docs, companyId] = await Promise.all([
    getT(),
    getPrefs(),
    getMoney(),
    listVehicles(),
    listTrailers(),
    listEmployees(),
    listFuel(),
    listServices(),
    listParts(),
    listPayments(),
    documentsWithOwner(),
    getCompanyId(),
  ]);
  const sr = locale === "sr";

  // ---- monthly costs (12 months, display currency)
  const months: MonthCosts[] = Array.from({ length: 12 }, (_, i) => i - 11).map((off) => {
    const b = monthBounds(off);
    const inB = (r: { date: string }) => r.date >= b.from && r.date <= b.to;
    return { key: b.key, fuel: m.sum(fuel.filter(inB)), services: m.sum(services.filter(inB)), parts: m.sum(parts.filter(inB)), payments: m.sum(payments.filter(inB)) };
  });
  const total = (x: MonthCosts) => x.fuel + x.services + x.parts + x.payments;
  const day = new Date().getDate();
  const b1 = monthBounds(-1);
  const cutoff = `${b1.key}-${String(day).padStart(2, "0")}`;
  const sameDays = (rows: { date: string; amount: number; currency: string }[]) => m.sum(rows.filter((r) => r.date >= b1.from && r.date <= cutoff));
  const thisMonth = total(months[11]);
  const costDelta = pctDelta(thisMonth, sameDays(fuel) + sameDays(services) + sameDays(parts) + sameDays(payments));

  const litres = (off: number) => fuel.filter((f) => inMonth(f.date, off)).reduce((s, f) => s + f.liters, 0);
  const litresLastSame = fuel.filter((f) => f.date >= b1.from && f.date <= cutoff).reduce((s, f) => s + f.liters, 0);
  const litresDelta = pctDelta(litres(0), litresLastSame);

  // ---- documents
  const states = docs.map((d) => expiryState(d.expiresAt, m.warnDays));
  const nExpired = states.filter((s) => s === "expired").length;
  const nSoon = states.filter((s) => s === "soon").length;
  const nOk = states.filter((s) => s === "ok").length;
  const upcoming = docs.filter((d) => {
    const n = daysUntil(d.expiresAt);
    return n !== null && n <= m.warnDays;
  });

  // ---- fleet status (live positions + asset status)
  const tracked = await db
    .select({ id: schema.vehicles.id, plate: schema.vehicles.plate, wialonUnitId: schema.vehicles.wialonUnitId, status: schema.vehicles.status })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.companyId, companyId));
  const live = await getPositions(tracked.map((v) => ({ ...v, driverName: null })));
  const stateOf = (id: string) => live.positions.find((p) => p.vehicleId === id)?.state ?? "offline";
  const active = vehicles.filter((v) => v.status === "active");
  const moving = active.filter((v) => stateOf(v.id) === "moving").length;
  const stopped = active.filter((v) => stateOf(v.id) === "stopped").length;
  const offline = active.length - moving - stopped;
  const inService = vehicles.filter((v) => v.status === "in_service").length;
  const inactive = vehicles.filter((v) => v.status === "inactive").length;

  // ---- per vehicle
  const perVehicle = vehicles
    .map((v) => {
      const f = (r: { vehicleId: string | null; date: string }) => r.vehicleId === v.id && inMonth(r.date, 0);
      return { v, sum: m.sum(fuel.filter(f)) + m.sum(services.filter(f)) + m.sum(parts.filter(f)) };
    })
    .filter((x) => x.sum > 0)
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 6);
  const cons = consumptionByVehicle(fuel);
  const consRows = vehicles
    .filter((v) => cons[v.id] && (v.type === "tractor" || v.type === "truck"))
    .map((v) => ({ v, l100: cons[v.id].l100 }))
    .sort((a, b) => b.l100 - a.l100)
    .slice(0, 6);

  const docHref = (d: { entityType: string; entityId: string }) => `/${d.entityType === "vehicle" ? "vehicles" : d.entityType === "trailer" ? "trailers" : "employees"}/${d.entityId}`;
  const viewAll = (href: string) => (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline">
      {t("c.viewAll")} <ArrowUpRight size={12} />
    </Link>
  );

  return (
    <>
      <PageHeader
        title={t("p.overview.title")}
        sub={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {t("p.overview.sub")}
            <span className="text-ink-4">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Dot tone={live.source === "wialon" ? "good" : "accent"} />
              {live.source === "wialon" ? "Wialon" : t("l.source.simulation")}
            </span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("d.costsMonth")}
          value={m.fmt(thisMonth)}
          trend={costDelta}
          trendUpIsGood={false}
          spark={months.slice(-6).map(total)}
          tone="accent"
          sub={sr ? `vs. 1–${day}. prošlog meseca` : `vs. days 1–${day} last month`}
        />
        <KpiCard
          label={sr ? "Gorivo ovog meseca" : "Fuel this month"}
          value={`${fmtNum(litres(0), locale)} l`}
          trend={litresDelta}
          trendUpIsGood={false}
          spark={[-5, -4, -3, -2, -1, 0].map(litres)}
          sub={m.fmt(m.sum(fuel.filter((f) => inMonth(f.date, 0))))}
          href="/fuel"
        />
        <KpiCard label={t("d.expired")} value={nExpired} sub={sr ? `${nSoon} ističe u narednih ${m.warnDays} dana` : `${nSoon} expiring in ${m.warnDays} days`} href="/documents?filter=attention" />
        <KpiCard
          label={t("d.activeVehicles")}
          value={`${active.length}/${vehicles.length}`}
          sub={`${moving} ${t("d.onRoad")} · ${trailers.filter((x) => x.status === "active").length} ${t("d.trailers").toLowerCase()} · ${employees.filter((e) => e.role === "driver").length} ${t("d.drivers").toLowerCase()}`}
          href="/vehicles"
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Shell title={sr ? "Stanje flote" : "Fleet status"} action={viewAll("/live")} innerClassName="px-4 pt-3 pb-5">
          <StatusColumns
            segments={[
              { key: "moving", label: t("l.moving"), count: moving, color: "#10b981" },
              { key: "stopped", label: t("l.stopped"), count: stopped, color: "#3b82f6" },
              { key: "offline", label: t("l.offline"), count: offline, color: "#9ca3af" },
              { key: "service", label: sr ? "Na servisu" : "In service", count: inService, color: "#f59e0b" },
              { key: "inactive", label: sr ? "Neaktivno" : "Inactive", count: inactive, color: "#ef4444" },
            ]}
          />
        </Shell>
        <Shell title={sr ? "Stanje dokumenata" : "Document status"} action={viewAll("/documents")} innerClassName="px-4 pt-3 pb-3">
          <Distribution
            labels={{ category: "Status", count: sr ? "Broj" : "Count", total: sr ? "Ukupno" : "Total" }}
            segments={[
              { key: "ok", label: t("e.ok"), count: nOk, color: "var(--good)", href: "/documents" },
              { key: "soon", label: t("e.soon"), count: nSoon, color: "var(--warn)", href: "/documents?filter=attention" },
              { key: "expired", label: t("e.expired"), count: nExpired, color: "var(--bad)", href: "/documents?filter=attention" },
            ]}
          />
        </Shell>
      </div>

      <Shell className="mt-3" tabbed title={t("d.costsByMonth")} action={<span>{m.currency}</span>}>
        <CostChart data={months} />
      </Shell>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Shell
          title={t("d.upcoming")}
          action={
            <span className="inline-flex items-center gap-3">
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <Dot tone="bad" /> {t("e.expired")}
              </span>
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <Dot tone="warn" /> {t("e.soon")}
              </span>
            </span>
          }
        >
          {upcoming.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-3">{t("d.upcomingEmpty")}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-ink-3">
                      <th className="h-8 pl-4 text-left font-medium">{t("f.docType")}</th>
                      <th className="px-3 text-left font-medium">{t("f.entityType")}</th>
                      <th className="hidden px-3 text-left font-medium sm:table-cell">{t("f.expiresAt")}</th>
                      <th className="pr-4 text-right font-medium">{t("f.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.slice(0, 7).map((d) => (
                      <tr key={d.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                        <td className="h-10 pl-4">
                          <Link href={docHref(d)} className="flex items-center gap-2.5 font-medium whitespace-nowrap text-ink">
                            <Dot tone={expiryState(d.expiresAt, m.warnDays) === "expired" ? "bad" : "warn"} />
                            {optLabel(DOC_TYPES[d.entityType as EntityType] ?? [], d.docType, locale)}
                          </Link>
                        </td>
                        <td className="px-3 whitespace-nowrap text-ink-2">
                          {d.ownerName} <span className="text-ink-4">· {optLabel(ENTITY_TYPES, d.entityType, locale).toLowerCase()}</span>
                        </td>
                        <td className="hidden px-3 whitespace-nowrap text-ink-2 tnum sm:table-cell">{fmtDate(d.expiresAt, locale)}</td>
                        <td className="pr-4 text-right">
                          <ExpiryBadge date={d.expiresAt} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-3">
                <span className="tnum">{sr ? `Prikazano ${Math.min(7, upcoming.length)} od ${upcoming.length}` : `Showing ${Math.min(7, upcoming.length)} of ${upcoming.length}`}</span>
                {viewAll("/documents?filter=attention")}
              </div>
            </>
          )}
        </Shell>

        <Shell icon={<MapIcon />} title={t("nav.live")} action={viewAll("/live")} innerClassName="min-h-[340px] p-1.5 pt-0">
          <LiveMini />
        </Shell>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Shell title={`${t("d.costsByVehicle")} · ${t("c.thisMonth").toLowerCase()}`} action={<span>{sr ? "gorivo, servisi, delovi" : "fuel, services, parts"}</span>}>
          {perVehicle.length ? (
            <HBars rows={perVehicle.map(({ v, sum }) => ({ key: v.id, label: v.plate, sub: [v.brand, v.model].filter(Boolean).join(" "), value: sum, display: m.fmt(sum), href: `/vehicles/${v.id}` }))} />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-ink-3">{t("c.empty")}</p>
          )}
        </Shell>
        <Shell title={t("d.topConsumption")} action={<span className="hidden sm:inline">{t("d.consumptionHint")}</span>}>
          {consRows.length ? (
            <HBars
              hue="green"
              rows={consRows.map(({ v, l100 }) => ({ key: v.id, label: v.plate, sub: [v.brand, v.model].filter(Boolean).join(" "), value: l100, display: `${fmtNum(l100, locale, 1)} l`, href: `/vehicles/${v.id}` }))}
            />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-ink-3">{t("c.empty")}</p>
          )}
        </Shell>
      </div>
    </>
  );
}
