"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { CalendarClock, ChevronRight, Container, Fuel, Package, Plus, Truck, UserPlus, Wallet, Wrench } from "lucide-react";
import { usePrefs } from "./prefs";
import { RecordForm } from "./record-form";
import { Menu, Modal, UnderlineTabs } from "./ui/client";
import { btnClass } from "./ui/primitives";
import { crumbsFor, GROUPS, isActive } from "@/lib/nav";
import { RESOURCES, type Refs, type ResourceKey } from "@/lib/resources";
import { RESOURCE_MODULE, ROUTE_MODULE } from "@/lib/auth/permissions";

export function Topbar({ refs }: { refs: Refs }) {
  const { t, can } = usePrefs();
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname);
  const [adding, setAdding] = useState<ResourceKey | null>(null);
  const isDetail = /^\/(vehicles|trailers|employees)\/[^/]+$/.test(pathname);

  const items = ([
    { r: "fuel", icon: <Fuel /> },
    { r: "services", icon: <Wrench /> },
    { r: "parts", icon: <Package /> },
    { r: "payments", icon: <Wallet /> },
    { r: "documents", icon: <CalendarClock /> },
    { r: "vehicles", icon: <Truck /> },
    { r: "trailers", icon: <Container /> },
    { r: "employees", icon: <UserPlus /> },
  ] as { r: Exclude<ResourceKey, "suppliers">; icon: React.ReactNode }[]).filter((x) => can(RESOURCE_MODULE[x.r], "edit"));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="flex h-12 items-center gap-3 px-4 sm:px-6 lg:pl-8">
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
        {items.length > 0 && <Menu
          label={t("q.new")}
          triggerClassName={btnClass("primary", "md")}
          trigger={
            <>
              <Plus size={14} />
              <span className="hidden sm:inline">{t("q.new")}</span>
            </>
          }
          items={items.map(({ r, icon }) => ({ label: cap(t(RESOURCES[r].title)), icon, onSelect: () => setAdding(r) }))}
        />}
      </div>
      <Modal open={!!adding} onClose={() => setAdding(null)} title={adding ? `${t("c.add")} ${t(RESOURCES[adding].title)}` : ""}>
        {adding && <RecordForm key={adding} resource={adding} record={null} refs={refs} onDone={() => setAdding(null)} onCancel={() => setAdding(null)} />}
      </Modal>
    </div>
  );
}

/** Underline tabs for a sidebar group (Flota → Vozila · Prikolice · …). */
export function SectionTabs({ group }: { group: "fleet" | "costs" }) {
  const { t, can } = usePrefs();
  const pathname = usePathname();
  const g0 = GROUPS.find((x) => x.key === group)!;
  const g = { ...g0, items: g0.items.filter((it) => { const m = ROUTE_MODULE[it.href]; return !m || can(m); }) };
  const active = g.items.find((it) => isActive(pathname, it.href))?.href ?? g.items[0].href;
  return <UnderlineTabs value={active} items={g.items.map((it) => ({ value: it.href, label: t(it.label), href: it.href }))} />;
}
