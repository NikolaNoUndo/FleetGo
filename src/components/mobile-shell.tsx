"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarClock, House, Map as MapIcon, Menu as MenuIcon, Plus, Receipt, Truck } from "lucide-react";
import { usePrefs } from "./prefs";
import { RoadlineMark } from "./brand";
import { QuickAdd } from "./topbar";
import { cn } from "./ui/primitives";
import { GROUPS, TOP, crumbsFor, isActive, type NavItem } from "@/lib/nav";
import type { Refs } from "@/lib/resources";
import { ROUTE_MODULE } from "@/lib/auth/permissions";

const DETAIL = /^\/(vehicles|trailers|employees)\/[^/]+$/;
const barBtn = "focus-ring relative grid size-10 shrink-0 place-items-center rounded-lg text-side-ink-2 transition-colors hover:bg-side-2 active:bg-side-3";

/**
 * Phones and tablets (below lg), in the app's own look: the sidebar's dark bar on top
 * (menu or back, page title, expiries), a light tab bar at the bottom and the green
 * "Novi unos" button in its middle. The menu button opens the sidebar as a drawer.
 */
export function MobileShell({ alerts, refs }: { alerts: { expired: number; soon: number }; refs: Refs }) {
  const { t, can, locale } = usePrefs();
  const sr = locale === "sr";
  const pathname = usePathname();
  const alertCount = alerts.expired + alerts.soon;

  const allowed = (it: NavItem) => {
    const m = ROUTE_MODULE[it.href];
    return !m || can(m);
  };
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);

  // title: the page's own name; detail pages go back to their list
  const crumbs = crumbsFor(pathname);
  const last = crumbs.at(-1);
  const detail = DETAIL.test(pathname) || pathname.startsWith("/live/places");
  const back = detail && last?.href ? { href: last.href, label: last.label } : null;
  const title = last ? t(last.label) : "Roadline";

  const fleet = groups.find((g) => g.key === "fleet");
  const costs = groups.find((g) => g.key === "costs");
  const tabs = [
    allowed(TOP[0]) && { key: "home", href: "/", label: t("nav.overview"), icon: House, active: pathname === "/" },
    allowed(TOP[1]) && { key: "live", href: "/live", label: sr ? "Mapa" : "Map", icon: MapIcon, active: isActive(pathname, "/live") },
    fleet && { key: "fleet", href: fleet.items[0].href, label: t("nav.fleet"), icon: Truck, active: fleet.items.some((it) => isActive(pathname, it.href)) },
    costs && { key: "costs", href: costs.items[0].href, label: t("nav.costs"), icon: Receipt, active: costs.items.some((it) => isActive(pathname, it.href)) },
  ].filter(Boolean) as { key: string; href: string; label: string; icon: typeof House; active: boolean }[];
  const half = Math.ceil(tabs.length / 2);

  const tabLink = (tab: (typeof tabs)[number]) => {
    const Icon = tab.icon;
    return (
      <Link
        key={tab.key}
        href={tab.href}
        aria-current={tab.active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", tab.active ? "text-accent-ink" : "text-ink-3")}
      >
        <Icon size={21} strokeWidth={tab.active ? 2 : 1.6} />
        {tab.label}
      </Link>
    );
  };

  return (
    <>
      {/* app bar in the sidebar's dark colour */}
      <header className="sticky top-[var(--bar-h,0px)] z-40 bg-side pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-14 items-center gap-1.5 px-2.5">
          {back ? (
            <Link href={back.href} className={barBtn} aria-label={t(back.label)}>
              <ArrowLeft size={19} strokeWidth={1.75} />
            </Link>
          ) : (
            <button type="button" onClick={() => window.dispatchEvent(new Event("rl:open-menu"))} className={barBtn} aria-label={t("nav.menu")}>
              <MenuIcon size={19} strokeWidth={1.75} />
            </button>
          )}
          {!back && <RoadlineMark size={15} className="mr-1 ml-0.5" />}
          <div className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.01em] text-side-ink">{back ? t(back.label) : title}</div>
          {can("documents") && (
            <Link href="/documents" className={barBtn} aria-label={t("nav.documents")}>
              <CalendarClock size={19} strokeWidth={1.75} />
              {alertCount > 0 && (
                <span
                  className={cn(
                    "absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-md px-1 text-[10px] font-semibold tnum",
                    alerts.expired ? "bg-bad text-white" : "bg-warn text-[#231500]",
                  )}
                >
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* tab bar with "Novi unos" in the middle */}
      <nav aria-label={t("nav.menu")} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex h-[58px] max-w-md items-stretch px-2">
          {tabs.slice(0, half).map(tabLink)}
          <div className="grid w-[72px] shrink-0 place-items-center">
            <QuickAdd
              refs={refs}
              triggerClassName="focus-ring grid size-11 place-items-center rounded-xl bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_16px_-6px_rgba(5,150,105,0.6)] transition-transform hover:bg-accent-hover active:scale-95"
              trigger={<Plus size={22} strokeWidth={2} />}
            />
          </div>
          {tabs.slice(half).map(tabLink)}
        </div>
      </nav>
    </>
  );
}
