"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronsUpDown, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { setPreference } from "@/app/actions";
import { usePrefs } from "./prefs";
import { cn } from "./ui/primitives";
import { Segmented } from "./ui/client";
import { BOTTOM, GROUPS, TOP, isActive, type NavItem } from "@/lib/nav";

export function Sidebar({ company, alerts, collapsed: initialCollapsed }: { company: string; alerts: { expired: number; soon: number }; collapsed: boolean }) {
  const { t, locale, currency } = usePrefs();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ fleet: true, costs: true });
  const [, start] = useTransition();
  const alertCount = alerts.expired + alerts.soon;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `fg_sidebar=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  const setPref = (key: "locale" | "currency", v: string) =>
    start(async () => {
      await setPreference(key, v);
      router.refresh();
    });

  const Badge = ({ it, mini }: { it: NavItem; mini?: boolean }) =>
    it.badge === "alerts" && alertCount > 0 ? (
      <span
        className={cn(
          "grid place-items-center rounded-md font-semibold tnum",
          mini ? "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]" : "h-5 min-w-5 px-1.5 text-xs",
          alerts.expired ? "bg-bad text-white" : "bg-warn text-[#231500]",
        )}
      >
        {alertCount}
      </span>
    ) : null;

  const Row = ({ it, child, rail }: { it: NavItem; child?: boolean; rail?: boolean }) => {
    const active = isActive(pathname, it.href);
    const Icon = it.icon;
    if (rail)
      return (
        <Link
          href={it.href}
          title={t(it.label)}
          aria-label={t(it.label)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "focus-ring relative mx-auto grid size-9 place-items-center rounded-lg transition-colors",
            active ? "bg-side-3 text-white" : "text-side-ink-2 hover:bg-side-2 hover:text-side-ink",
          )}
        >
          <Icon />
          <Badge it={it} mini />
        </Link>
      );
    return (
      <Link
        href={it.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
          active ? "bg-side-3 font-medium text-white" : child ? "text-side-ink-2 hover:bg-side-2 hover:text-side-ink" : "text-side-ink hover:bg-side-2",
        )}
      >
        {!child && <Icon />}
        <span className="flex-1 truncate">{t(it.label)}</span>
        <Badge it={it} />
      </Link>
    );
  };

  const full = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-3">
        <Logo />
        <span className="text-sm font-semibold tracking-[-0.01em] text-white">FleetGo</span>
        <span className="rounded border border-side-line px-1 text-[10px] font-medium text-side-ink-3">v0.1</span>
      </div>

      <nav className="side-scroll mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {TOP.map((it) => (
          <Row key={it.href} it={it} />
        ))}
        {GROUPS.map((g) => {
          const open = openGroups[g.key];
          const groupActive = g.items.some((it) => isActive(pathname, it.href));
          const GIcon = g.icon;
          return (
            <div key={g.key} className="pt-0.5">
              <button
                type="button"
                onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !s[g.key] }))}
                aria-expanded={open}
                className={cn(
                  "focus-ring flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  groupActive && !open ? "bg-side-2 text-white" : "text-side-ink hover:bg-side-2",
                )}
              >
                <GIcon />
                <span className="flex-1 text-left">{t(g.label)}</span>
                {!open && g.items.some((it) => it.badge === "alerts") && alertCount > 0 && <span className={cn("size-1.5 rounded-full", alerts.expired ? "bg-bad" : "bg-warn")} />}
                <ChevronDown className={cn("text-side-ink-3 transition-transform", !open && "-rotate-90")} />
              </button>
              {open && (
                <div className="relative mt-0.5 ml-[17px] space-y-0.5 border-l border-side-line pl-2.5">
                  {g.items.map((it) => (
                    <Row key={it.href} it={it} child />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-side-line px-2 pt-3 pb-3">
        {BOTTOM.map((it) => (
          <Row key={it.href} it={it} />
        ))}
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1">
          <Segmented dark size="sm" value={locale} onChange={(v) => setPref("locale", v)} items={[{ value: "sr", label: "SR" }, { value: "en", label: "EN" }]} />
          <Segmented dark size="sm" value={currency} onChange={(v) => setPref("currency", v)} items={[{ value: "EUR", label: "EUR" }, { value: "RSD", label: "RSD" }]} />
        </div>
        <button type="button" title={t("s.accessHint")} className="focus-ring flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left hover:bg-side-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white text-xs font-semibold text-ink">{company.slice(0, 1)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-side-ink">{company}</span>
            <span className="block text-xs text-side-ink-3">{t("nav.owner")}</span>
          </span>
          <ChevronsUpDown className="text-side-ink-3" />
        </button>
      </div>
    </div>
  );

  const rail = (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-14 items-center">
        <Logo />
      </div>
      <nav className="side-scroll mt-2 flex w-full flex-1 flex-col gap-1 overflow-y-auto pb-4">
        {TOP.map((it) => (
          <Row key={it.href} it={it} rail />
        ))}
        {GROUPS.map((g) => (
          <div key={g.key} className="mt-2 flex flex-col gap-1 border-t border-side-line pt-3">
            {g.items.map((it) => (
              <Row key={it.href} it={it} rail />
            ))}
          </div>
        ))}
      </nav>
      <div className="flex w-full flex-col gap-1 border-t border-side-line py-3">
        {BOTTOM.map((it) => (
          <Row key={it.href} it={it} rail />
        ))}
        <span title={company} className="mx-auto mt-1 grid size-7 place-items-center rounded-md bg-white text-xs font-semibold text-ink">
          {company.slice(0, 1)}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex h-12 items-center gap-2.5 bg-side px-4 lg:hidden">
        <Logo />
        <span className="text-sm font-semibold text-white">FleetGo</span>
        <button type="button" onClick={() => setMobileOpen(true)} className="focus-ring ml-auto grid size-8 place-items-center rounded-lg text-side-ink-2 hover:bg-side-2" aria-label={t("nav.menu")}>
          <MenuIcon size={18} />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="animate-pop absolute inset-y-0 left-0 w-[264px] bg-side">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute top-3.5 right-3 z-10 grid size-7 place-items-center rounded-md text-side-ink-2 hover:bg-side-2" aria-label={t("c.close")}>
              <X />
            </button>
            {full}
          </aside>
        </div>
      )}

      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 bg-side transition-[width] duration-200 lg:block", collapsed ? "w-16" : "w-[248px]")}>
        {collapsed ? rail : full}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="focus-ring absolute top-[15px] -right-3.5 z-20 grid size-7 place-items-center rounded-full border-2 border-side bg-white text-ink shadow-sm hover:bg-surface-2"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-side">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 17V7h9v10" />
        <path d="M13 10h4l3 3.5V17h-7" />
        <circle cx="7.5" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
