"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { House, Map as MapIcon, Menu as MenuIcon, Plus, Receipt, Truck } from "lucide-react";
import { usePrefs } from "./prefs";
import { RoadlineLogo } from "./brand";
import { QuickAdd } from "./topbar";
import { cn } from "./ui/primitives";
import { GROUPS, TOP, isActive, type NavItem } from "@/lib/nav";
import type { Refs } from "@/lib/resources";
import { ROUTE_MODULE } from "@/lib/auth/permissions";

const barBtn = "focus-ring relative grid size-11 shrink-0 place-items-center rounded-lg text-side-ink-2 transition-colors hover:bg-side-2 active:bg-side-3";

/**
 * Phones and tablets (below lg), in the app's own look: the sidebar's dark bar on top
 * with the logo and the menu button (it opens the sidebar as a drawer), and a light
 * icon-only tab bar at the bottom with the green "Novi unos" button in its middle.
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
        aria-label={tab.label}
        aria-current={tab.active ? "page" : undefined}
        className={cn("relative flex flex-1 items-center justify-center transition-colors", tab.active ? "text-accent-ink" : "text-ink-3")}
      >
        <Icon size={23} strokeWidth={tab.active ? 2 : 1.6} />
        <span className={cn("absolute bottom-2 size-1 rounded-full bg-accent transition-opacity", tab.active ? "opacity-100" : "opacity-0")} />
      </Link>
    );
  };

  return (
    <>
      {/* app bar in the sidebar's dark colour: logo and name, menu */}
      <header className="sticky top-[var(--bar-h,0px)] z-40 bg-side pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-16 items-center justify-between pr-3 pl-4">
          <Link href="/" aria-label="Roadline" className="focus-ring -ml-1 rounded-md p-1">
            <RoadlineLogo height={20} />
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event("rl:open-menu"))} className={barBtn} aria-label={t("nav.menu")}>
            <MenuIcon size={21} strokeWidth={1.75} />
            {alertCount > 0 && <span className={cn("absolute top-2 right-2 size-2 rounded-full ring-2 ring-side", alerts.expired ? "bg-bad" : "bg-warn")} />}
          </button>
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
