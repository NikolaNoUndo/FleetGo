"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarClock,
  ChevronsUpDown,
  Container,
  Fuel,
  LayoutGrid,
  Map as MapIcon,
  Menu as MenuIcon,
  Package,
  Settings,
  Truck,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { setPreference } from "@/app/actions";
import { usePrefs } from "./prefs";
import { cn } from "./ui/primitives";
import { Segmented } from "./ui/client";
import type { TKey } from "@/lib/i18n";

type Item = { href: string; label: TKey; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: number };

export function Sidebar({ company, alerts }: { company: string; alerts: { expired: number; soon: number } }) {
  const { t, locale, currency } = usePrefs();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const groups: { title?: TKey; items: Item[] }[] = [
    {
      items: [
        { href: "/", label: "nav.overview", icon: LayoutGrid },
        { href: "/live", label: "nav.live", icon: MapIcon },
      ],
    },
    {
      title: "nav.fleet",
      items: [
        { href: "/vehicles", label: "nav.vehicles", icon: Truck },
        { href: "/trailers", label: "nav.trailers", icon: Container },
        { href: "/employees", label: "nav.employees", icon: Users },
        { href: "/documents", label: "nav.documents", icon: CalendarClock, badge: alerts.expired + alerts.soon },
      ],
    },
    {
      title: "nav.costs",
      items: [
        { href: "/fuel", label: "nav.fuel", icon: Fuel },
        { href: "/services", label: "nav.services", icon: Wrench },
        { href: "/parts", label: "nav.parts", icon: Package },
        { href: "/payments", label: "nav.payments", icon: Wallet },
      ],
    },
    { title: "nav.company", items: [{ href: "/settings", label: "nav.settings", icon: Settings }] },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const setPref = (key: "locale" | "currency", v: string) =>
    start(async () => {
      await setPreference(key, v);
      router.refresh();
    });

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-3 pt-5 pb-4">
        <Logo />
        <span className="text-[17px] font-semibold tracking-[-0.02em]">FleetGo</span>
        <span className="ml-auto rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3">v0.1</span>
      </div>

      <button type="button" className="raised focus-ring mx-1 flex h-11 items-center gap-2.5 rounded-[12px] px-3 text-left" title={t("s.accessHint")}>
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-semibold text-white">{company.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{company}</span>
          <span className="block text-[11.5px] text-ink-3">{t("nav.owner")}</span>
        </span>
        <ChevronsUpDown size={15} className="text-ink-3" />
      </button>

      <nav className="mt-4 flex-1 overflow-y-auto px-1 pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {g.title && (
              <div className="mb-1.5 flex items-center gap-3 px-2.5">
                <span className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">{t(g.title)}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const active = isActive(it.href);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring flex h-9 items-center gap-2.5 rounded-[10px] border px-2.5 text-[14px] transition-colors",
                        active ? "raised border-line font-medium text-ink" : "border-transparent text-ink-2 hover:bg-surface-3/70 hover:text-ink",
                      )}
                    >
                      <Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
                      <span className="flex-1 truncate">{t(it.label)}</span>
                      {!!it.badge && (
                        <span
                          className={cn(
                            "tnum grid h-5 min-w-5 place-items-center rounded-md px-1.5 text-[11px] font-semibold",
                            alerts.expired ? "bg-bad-soft text-[#b42318]" : "bg-warn-soft text-[#9a5b00]",
                          )}
                        >
                          {it.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line px-2 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-3">{t("c.language")}</span>
          <Segmented size="sm" value={locale} onChange={(v) => setPref("locale", v)} items={[{ value: "sr", label: "SR" }, { value: "en", label: "EN" }]} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-3">{t("c.showIn")}</span>
          <Segmented size="sm" value={currency} onChange={(v) => setPref("currency", v)} items={[{ value: "EUR", label: "EUR" }, { value: "RSD", label: "RSD" }]} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2.5 border-b border-line bg-side/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <span className="font-semibold tracking-[-0.02em]">FleetGo</span>
        <button type="button" onClick={() => setOpen(true)} className="focus-ring ml-auto grid size-9 place-items-center rounded-[10px] text-ink-2 hover:bg-surface-3" aria-label={t("nav.menu")}>
          <MenuIcon size={20} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          <aside className="animate-pop absolute inset-y-0 left-0 w-[284px] border-r border-line bg-side px-3">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-3 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-3" aria-label={t("c.close")}>
              <X size={18} />
            </button>
            {body}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 border-r border-line bg-side px-3 lg:block">{body}</aside>
    </>
  );
}

function Logo() {
  return (
    <span className="grid size-7 place-items-center rounded-[8px] bg-ink text-white shadow-xs">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 17V7h9v10" />
        <path d="M13 10h4l3 3.5V17h-7" />
        <circle cx="7.5" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
