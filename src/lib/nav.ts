import {
  Building2,
  CalendarClock,
  Container,
  FileText,
  Fuel,
  House,
  Map as MapIcon,
  Package,
  Receipt,
  Settings,
  Store,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TKey } from "./i18n";

export type NavItem = { href: string; label: TKey; icon: LucideIcon; badge?: "alerts" };
export type NavGroup = { key: "fleet" | "costs"; label: TKey; icon: LucideIcon; items: NavItem[] };

export const TOP: NavItem[] = [
  { href: "/", label: "nav.overview", icon: House },
  { href: "/live", label: "nav.live", icon: MapIcon },
  { href: "/reports", label: "nav.reports", icon: FileText },
];

export const GROUPS: NavGroup[] = [
  {
    key: "fleet",
    label: "nav.fleet",
    icon: Truck,
    items: [
      { href: "/vehicles", label: "nav.vehicles", icon: Truck },
      { href: "/trailers", label: "nav.trailers", icon: Container },
      { href: "/employees", label: "nav.employees", icon: Users },
      { href: "/documents", label: "nav.documents", icon: CalendarClock, badge: "alerts" },
    ],
  },
  {
    key: "costs",
    label: "nav.costs",
    icon: Receipt,
    items: [
      { href: "/fuel", label: "nav.fuel", icon: Fuel },
      { href: "/services", label: "nav.services", icon: Wrench },
      { href: "/parts", label: "nav.parts", icon: Package },
      { href: "/suppliers", label: "nav.suppliers", icon: Store },
      { href: "/payments", label: "nav.payments", icon: Wallet },
      { href: "/expenses", label: "nav.expenses", icon: Building2 },
    ],
  },
];

export const BOTTOM: NavItem[] = [{ href: "/settings", label: "nav.settings", icon: Settings }];

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

/** Breadcrumb trail for the top bar: [group?, page]. */
export function crumbsFor(pathname: string): { label: TKey; href?: string }[] {
  for (const it of TOP) if (isActive(pathname, it.href)) return [{ label: it.label, href: it.href }];
  for (const g of GROUPS)
    for (const it of g.items)
      if (isActive(pathname, it.href)) return [{ label: g.label, href: g.items[0].href }, { label: it.label, href: it.href }];
  for (const it of BOTTOM) if (isActive(pathname, it.href)) return [{ label: "nav.company" }, { label: it.label, href: it.href }];
  if (isActive(pathname, "/profile")) return [{ label: "nav.profile", href: "/profile" }];
  return [];
}
