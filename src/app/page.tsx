import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BarChart3, CalendarClock, Container, Droplets, Map as MapIcon, MonitorSmartphone, Receipt, Truck, Users, XCircle } from "lucide-react";
import { PageHeader, Progress, Shell, cn } from "@/components/ui/primitives";
import { ExpiryBadge } from "@/components/ui/client";
import { Stat, StatRow } from "@/components/stat";
import { CostChart, type MonthCosts } from "@/components/charts/cost-chart";
import { LiveMini } from "@/components/map/live-view";
import { getPrefs, getT } from "@/lib/prefs";
import {
  consumptionByVehicle,
  documentsWithOwner,
  getAlertCounts,
  listEmployees,
  listFuel,
  listParts,
  listPayments,
  listServices,
  listTrailers,
  listVehicles,
} from "@/lib/queries";
import { getMoney, inMonth, monthBounds, pctDelta } from "@/lib/money-server";
import { DOC_TYPES, type EntityType, optLabel } from "@/lib/catalog";
import { daysUntil, fmtNum } from "@/lib/format";

export default async function OverviewPage() {
  const [t, { locale }, m, vehicles, trailers, employees, fuel, services, parts, payments, docs, alerts] = await Promise.all([
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
    getAlertCounts(),
  ]);

  // Monthly costs, last 6 months, in display currency
  const months: MonthCosts[] = [-5, -4, -3, -2, -1, 0].map((off) => {
    const b = monthBounds(off);
    const inB = (r: { date: string }) => r.date >= b.from && r.date <= b.to;
    return {
      key: b.key,
      fuel: m.sum(fuel.filter(inB)),
      services: m.sum(services.filter(inB)),
      parts: m.sum(parts.filter(inB)),
      payments: m.sum(payments.filter(inB)),
    };
  });
  const total = (x: MonthCosts) => x.fuel + x.services + x.parts + x.payments;
  const thisMonth = total(months[5]);
  // compare like with like: last month up to the same day of month
  const dayOfMonth = new Date().getDate();
  const lastSameDay = (() => {
    const b = monthBounds(-1);
    const cutoff = `${b.key}-${String(dayOfMonth).padStart(2, "0")}`;
    const f = (r: { date: string }) => r.date >= b.from && r.date <= cutoff;
    return m.sum(fuel.filter(f)) + m.sum(services.filter(f)) + m.sum(parts.filter(f)) + m.sum(payments.filter(f));
  })();
  const delta = pctDelta(thisMonth, lastSameDay);

  const activeVehicles = vehicles.filter((v) => v.status === "active").length;
  const drivers = employees.filter((e) => e.role === "driver");
  const byType = (type: string) => vehicles.filter((v) => v.type === type).length;

  const upcoming = docs
    .filter((d) => {
      const n = daysUntil(d.expiresAt);
      return n !== null && n <= m.warnDays;
    })
    .slice(0, 7);

  // Cost per vehicle this month (fuel + services + parts)
  const perVehicle = vehicles
    .map((v) => {
      const f = (r: { vehicleId: string | null; date: string }) => r.vehicleId === v.id && inMonth(r.date, 0);
      return { v, sum: m.sum(fuel.filter(f)) + m.sum(services.filter(f)) + m.sum(parts.filter(f)) };
    })
    .filter((x) => x.sum > 0)
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 6);
  const maxPer = Math.max(...perVehicle.map((x) => x.sum), 1);

  const cons = consumptionByVehicle(fuel);
  const consRows = vehicles
    .filter((v) => cons[v.id] && (v.type === "tractor" || v.type === "truck"))
    .map((v) => ({ v, l100: cons[v.id].l100 }))
    .sort((a, b) => b.l100 - a.l100)
    .slice(0, 6);
  const fleetAvg = consRows.length ? consRows.reduce((s, x) => s + x.l100, 0) / consRows.length : 0;

  const docHref = (d: { entityType: string; entityId: string }) =>
    `/${d.entityType === "vehicle" ? "vehicles" : d.entityType === "trailer" ? "trailers" : "employees"}/${d.entityId}`;

  const fleetRows = [
    { href: "/vehicles", icon: Truck, label: locale === "sr" ? "Tegljači" : "Tractor units", value: byType("tractor"), accent: true },
    { href: "/vehicles", icon: Truck, label: locale === "sr" ? "Kamioni i kombiji" : "Trucks & vans", value: byType("truck") + byType("van") + byType("car") },
    { href: "/trailers", icon: Container, label: t("d.trailers"), value: trailers.length },
    { href: "/employees", icon: Users, label: t("d.drivers"), value: drivers.length },
  ];

  return (
    <>
      <PageHeader title={t("p.overview.title")} sub={t("p.overview.sub")} />

      <StatRow>
        <Stat icon={<Truck />} label={t("d.activeVehicles")} value={`${activeVehicles}/${vehicles.length}`} sub={`${trailers.filter((x) => x.status === "active").length} ${t("d.trailers").toLowerCase()}`} />
        <Stat
          icon={<XCircle />}
          label={t("d.expired")}
          value={alerts.expired}
          delta={alerts.expired ? (locale === "sr" ? "Hitno" : "Urgent") : undefined}
          deltaTone="bad"
          sub={
            <Link href="/documents?filter=attention" className="hover:text-ink">
              {t("c.viewAll")} →
            </Link>
          }
        />
        <Stat icon={<AlertTriangle />} label={t("d.soon", { n: m.warnDays })} value={alerts.soon} />
        <Stat
          icon={<Receipt />}
          label={t("d.costsMonth")}
          value={m.fmt(thisMonth)}
          delta={delta?.text}
          deltaTone="neutral"
          sub={delta ? `${t("d.vsLast")} (${dayOfMonth}.)` : undefined}
        />
      </StatRow>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Shell icon={<BarChart3 />} title={t("d.costsByMonth")} action={<span className="text-[12.5px] text-ink-3">{t("d.last6")} · {m.currency}</span>}>
          <CostChart data={months} />
        </Shell>

        <Shell icon={<MonitorSmartphone />} title={t("d.fleet")}>
          <ul className="px-2 py-2">
            {fleetRows.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.label}>
                  <Link
                    href={r.href}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors hover:bg-surface-2",
                      r.accent ? "text-accent" : "text-ink-2",
                    )}
                  >
                    <Icon size={20} strokeWidth={1.8} />
                    <span className="flex-1 font-medium">{r.label}</span>
                    <span className="text-[16px] font-medium tnum">{r.value}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-5 py-3.5">
            <div className="mb-2 flex items-baseline justify-between text-[13px]">
              <span className="text-ink-3">
                <span className="font-semibold text-ink tnum">{activeVehicles}</span> {locale === "sr" ? "aktivno" : "active"} /{" "}
                <span className="font-semibold text-ink tnum">{vehicles.length}</span> {locale === "sr" ? "vozila" : "vehicles"}
              </span>
            </div>
            <Progress value={activeVehicles / Math.max(vehicles.length, 1)} />
          </div>
        </Shell>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Shell
          icon={<CalendarClock />}
          title={t("d.upcoming")}
          action={
            <Link href="/documents?filter=attention" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
              {t("c.viewAll")} <ArrowUpRight size={14} />
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">{t("d.upcomingEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {upcoming.map((d) => (
                <li key={d.id}>
                  <Link href={docHref(d)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{optLabel(DOC_TYPES[d.entityType as EntityType] ?? [], d.docType, locale)}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{d.ownerName}</span>
                    </span>
                    <ExpiryBadge date={d.expiresAt} compact />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Shell>

        <Shell
          icon={<MapIcon />}
          title={t("nav.live")}
          action={
            <Link href="/live" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
              {t("c.open")} <ArrowUpRight size={14} />
            </Link>
          }
          innerClassName="h-[360px] overflow-hidden"
        >
          <LiveMini />
        </Shell>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Shell icon={<Receipt />} title={`${t("d.costsByVehicle")} · ${t("c.thisMonth").toLowerCase()}`}>
          {perVehicle.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">{t("c.empty")}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {perVehicle.map(({ v, sum }) => (
                <li key={v.id}>
                  <Link href={`/vehicles/${v.id}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-4 px-5 py-3.5 hover:bg-surface-2/60">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-medium">{v.plate}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{[v.brand, v.model].filter(Boolean).join(" ")}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <span className="text-[13.5px] font-semibold tnum">{m.fmt(sum)}</span>
                      <Progress value={sum / maxPer} tone="accent" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Shell>

        <Shell icon={<Droplets />} title={t("d.topConsumption")} action={<span className="text-[12.5px] text-ink-3">{t("d.consumptionHint")}</span>}>
          {consRows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">{t("c.empty")}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {consRows.map(({ v, l100 }) => {
                const high = l100 > fleetAvg * 1.05;
                return (
                  <li key={v.id}>
                    <Link href={`/vehicles/${v.id}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-4 px-5 py-3.5 hover:bg-surface-2/60">
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-medium">{v.plate}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">{[v.brand, v.model].filter(Boolean).join(" ")}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1.5">
                        <span className={cn("text-[13.5px] font-semibold tnum", high && "text-warn")}>{fmtNum(l100, locale, 1)} l/100 km</span>
                        <Progress value={l100 / 45} tone={high ? "warn" : "good"} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Shell>
      </div>
    </>
  );
}
