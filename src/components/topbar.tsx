"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { CalendarClock, ChevronRight, Container, Fuel, Package, Route, Plus, Truck, UserPlus, Wallet, Wrench, Building2 } from "lucide-react";
import type { TKey } from "@/lib/i18n";
import { usePrefs } from "./prefs";
import { RecordForm } from "./record-form";
import { Menu, Modal, UnderlineTabs } from "./ui/client";
import { btnClass } from "./ui/primitives";
import { crumbsFor, GROUPS, isActive } from "@/lib/nav";
import { RESOURCES, type Refs, type ResourceKey } from "@/lib/resources";
import { RESOURCE_MODULE, ROUTE_MODULE } from "@/lib/auth/permissions";

export const QUICK_ADD: { r: Exclude<ResourceKey, "suppliers" | "places" | "clients" | "tourLegs">; icon: React.ReactNode }[] = [
  { r: "tours", icon: <Route /> },
  { r: "fuel", icon: <Fuel /> },
  { r: "services", icon: <Wrench /> },
  { r: "parts", icon: <Package /> },
  { r: "payments", icon: <Wallet /> },
  { r: "expenses", icon: <Building2 /> },
  { r: "documents", icon: <CalendarClock /> },
  { r: "vehicles", icon: <Truck /> },
  { r: "trailers", icon: <Container /> },
  { r: "employees", icon: <UserPlus /> },
];

/** "Novi unos": a menu of everything the member may add, each opening its form. */
export function QuickAdd({ refs, triggerClassName, trigger }: { refs: Refs; triggerClassName: string; trigger: React.ReactNode }) {
  const { t, can } = usePrefs();
  const [adding, setAdding] = useState<ResourceKey | null>(null);
  const items = QUICK_ADD.filter((x) => can(RESOURCE_MODULE[x.r], "edit"));
  if (!items.length) return null;
  return (
    <>
      <Menu
        label={t("q.new")}
        triggerClassName={triggerClassName}
        trigger={trigger}
        items={items.map(({ r, icon }) => ({ label: t(`q.${r}` as TKey), icon, onSelect: () => setAdding(r) }))}
      />
      <Modal open={!!adding} wide={adding === "tours"} onClose={() => setAdding(null)} title={adding ? `${t("c.add")} ${t(RESOURCES[adding].title)}` : ""}>
        {adding && <RecordForm key={adding} resource={adding} record={null} refs={refs} onDone={() => setAdding(null)} onCancel={() => setAdding(null)} />}
      </Modal>
    </>
  );
}

/** Breadcrumbs and "Novi unos" above the page (desktop; phones use the app bar and tab bar). */
export function Topbar({ refs }: { refs: Refs }) {
  const { t } = usePrefs();
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname);
  const isDetail = /^\/(vehicles|trailers|employees)\/[^/]+$/.test(pathname);

  return (
    <div className="hidden h-12 items-center gap-3 px-4 sm:px-6 lg:flex lg:pl-8">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && <ChevronRight className="shrink-0 text-ink-4" />}
            {c.href && (i < crumbs.length - 1 || isDetail) ? (
              <Link href={c.href} className="truncate text-ink-3 hover:text-ink">
                {t(c.label)}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "truncate font-medium text-ink" : "truncate text-ink-3"}>{t(c.label)}</span>
            )}
          </Fragment>
        ))}
        {isDetail && (
          <>
            <ChevronRight className="shrink-0 text-ink-4" />
            <span className="truncate font-medium text-ink">{t("c.details")}</span>
          </>
        )}
      </nav>
      <div className="ml-auto">
        <QuickAdd
          refs={refs}
          triggerClassName={btnClass("primary", "md")}
          trigger={
            <>
              <Plus size={14} />
              <span>{t("q.new")}</span>
            </>
          }
        />
      </div>
    </div>
  );
}

/** Underline tabs for a sidebar group (Flota → Vozila · Prikolice · …). */
export function SectionTabs({ group }: { group: "tours" | "fleet" | "costs" }) {
  const { t, can } = usePrefs();
  const pathname = usePathname();
  const g0 = GROUPS.find((x) => x.key === group)!;
  const g = { ...g0, items: g0.items.filter((it) => { const m = ROUTE_MODULE[it.href]; return !m || can(m); }) };
  const active = g.items.find((it) => isActive(pathname, it.href))?.href ?? g.items[0].href;
  return <UnderlineTabs value={active} items={g.items.map((it) => ({ value: it.href, label: t(it.label), href: it.href }))} />;
}
