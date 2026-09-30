"use client";

import Link from "@/components/ui/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, CalendarClock, ChevronDown, House, Languages, LucideProvider, LogOut, Map as MapIcon, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus, UserRound, Wallet, X } from "lucide-react";
import { setPreference, switchCompany } from "@/app/actions";
import { logout } from "@/app/auth-actions";
import { usePrefs } from "./prefs";
import { RoadlineLogo, RoadlineMark } from "./brand";
import { UserAvatar } from "./user-avatar";
import { cn } from "./ui/primitives";
import { Popover, Segmented } from "./ui/client";
import { BOTTOM, GROUPS, TOP, crumbsFor, isActive, type NavItem } from "@/lib/nav";
import type { Refs } from "@/lib/resources";
import { QuickAdd } from "./topbar";
import { ROUTE_MODULE, ROLES } from "@/lib/auth/permissions";

type Company = { id: string; name: string; role?: string };
type UserInfo = { name: string | null; email: string; role: string };

const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join("");

export function Sidebar({
  company,
  companies,
  user,
  alerts,
  collapsed: initialCollapsed,
  refs,
}: {
  refs: Refs;
  company: Company;
  companies: Company[];
  user: UserInfo;
  alerts: { expired: number; soon: number };
  collapsed: boolean;
}) {
  const { t, locale, currency, can } = usePrefs();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ fleet: true, costs: true });
  const [, start] = useTransition();
  const alertCount = alerts.expired + alerts.soon;
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const allowed = (it: NavItem) => {
    const m = ROUTE_MODULE[it.href];
    return !m || can(m);
  };
  const top = TOP.filter(allowed);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);
  const bottom = BOTTOM.filter(allowed);
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label[locale] ?? user.role;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `rl_sidebar=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const setPref = (key: "locale" | "currency", v: string) =>
    start(async () => {
      await setPreference(key, v);
      router.refresh();
    });
  const goCompany = (id: string) =>
    start(async () => {
      await switchCompany(id);
      router.push("/");
      router.refresh();
    });

  const AlertBadge = ({ it, mini }: { it: NavItem; mini?: boolean }) =>
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

  /* ---- phones ---- */
  // detail pages get a back link to their list instead of the logo
  const crumbs = crumbsFor(pathname);
  const onDetail = /^\/(vehicles|trailers|employees)\/[^/]+$/.test(pathname) || pathname === "/live/places" || pathname.startsWith("/live/places/");
  const back = onDetail ? crumbs.at(-1) ?? null : null;
  const backTarget = back?.href ? { href: back.href, label: back.label } : null;
  type Tab = NavItem | "add";
  const tabDefs: Tab[] = [
    { href: "/", label: "nav.overview", icon: House },
    { href: "/live", label: "nav.live", icon: MapIcon },
    "add",
    { href: "/documents", label: "nav.documents", icon: CalendarClock, badge: "alerts" },
  ];
  const tabs = tabDefs.filter((x) => x === "add" || allowed(x));
  const tabHrefs = tabs.filter((x): x is NavItem => x !== "add").map((x) => x.href);
  const menuActive = !tabHrefs.some((h) => isActive(pathname, h));
  const shortLabel: Partial<Record<string, { sr: string; en: string }>> = {
    "/live": { sr: "Mapa", en: "Map" },
    "/documents": { sr: "Rokovi", en: "Expiries" },
  };

  const TabLink = ({ it }: { it: NavItem }) => {
    const active = isActive(pathname, it.href) && !mobileOpen;
    const Icon = it.icon;
    return (
      <Link
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn("relative flex w-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-accent-ink" : "text-ink-3")}
      >
        <span className="relative">
          <Icon size={22} strokeWidth={active ? 2 : 1.75} />
          <AlertBadge it={it} mini />
        </span>
        {shortLabel[it.href]?.[locale] ?? t(it.label)}
      </Link>
    );
  };

  const Tile = ({ it }: { it: NavItem }) => {
    const active = isActive(pathname, it.href);
    const Icon = it.icon;
    return (
      <Link
        href={it.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-[78px] flex-col items-center justify-start gap-1.5 rounded-2xl border px-1 pt-3.5 pb-2.5 text-center text-[11.5px] leading-[14px] font-medium transition-colors active:bg-surface-3",
          active ? "border-accent-line bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2",
        )}
      >
        <Icon size={21} strokeWidth={1.6} className={cn("shrink-0", active ? "text-accent-ink" : "text-ink-2")} />
        <span className="line-clamp-2">{t(it.label)}</span>
        <span className="absolute top-1.5 right-1.5">
          <AlertBadge it={it} />
        </span>
      </Link>
    );
  };

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
          <Icon size={16} />
          <AlertBadge it={it} mini />
        </Link>
      );
    return (
      <Link
        href={it.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
          active ? "bg-side-3 font-medium text-white" : child ? "text-side-ink-2 hover:bg-side-2 hover:text-side-ink" : "text-side-ink hover:bg-side-2",
        )}
      >
        {!child && <Icon />}
        <span className="flex-1 truncate">{t(it.label)}</span>
        <AlertBadge it={it} />
      </Link>
    );
  };

  /* company, language, currency, profile, sign out */
  const accountPanel = (close: () => void, sheet?: boolean) => (
        <div className={sheet ? "" : "w-[256px]"}>
          {/* company on top; a switcher when the member belongs to more than one */}
          <div className="border-b border-line px-1 pt-1 pb-2">
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <span className="grid size-[38px] shrink-0 place-items-center rounded-[9px] bg-side text-sm font-semibold text-white">{initials(company.name)}</span>
              <span className="min-w-0 flex-1 py-0.5">
                <span className="block truncate text-sm font-medium">{company.name}</span>
                <span className="block truncate text-xs text-ink-3">{roleLabel}</span>
              </span>
            </div>
            {companies.length > 1 && (
              <div className="mt-1.5">
                <div className="px-1.5 pb-1 text-xs font-medium text-ink-3">{locale === "sr" ? "Promeni firmu" : "Switch company"}</div>
                {companies
                  .filter((c) => c.id !== company.id)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        close();
                        goCompany(c.id);
                      }}
                      className="flex h-9 w-full items-center gap-2.5 rounded-lg px-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="grid size-6 place-items-center rounded-md bg-surface-3 text-[10px] font-semibold">{initials(c.name)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div className="space-y-1 border-b border-line px-1 py-2">
            <div className="flex h-9 items-center justify-between gap-2 px-1.5">
              <span className="inline-flex items-center gap-2 text-sm text-ink-2">
                <Languages className="text-ink-3" />
                {t("c.language")}
              </span>
              <Segmented size="sm" value={locale} onChange={(v) => setPref("locale", v)} items={[{ value: "sr", label: "SR" }, { value: "en", label: "EN" }]} />
            </div>
            <div className="flex h-9 items-center justify-between gap-2 px-1.5">
              <span className="inline-flex items-center gap-2 text-sm text-ink-2">
                <Wallet className="text-ink-3" />
                {locale === "sr" ? "Valuta" : "Currency"}
              </span>
              <Segmented size="sm" value={currency} onChange={(v) => setPref("currency", v)} items={[{ value: "EUR", label: "EUR" }, { value: "RSD", label: "RSD" }]} />
            </div>
          </div>
          <div className="border-b border-line px-1 py-1">
            <Link
              href="/profile"
              onClick={() => {
                close();
                setMobileOpen(false);
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <UserRound className="text-ink-3" />
              {locale === "sr" ? "Profil i bezbednost" : "Profile & security"}
            </Link>
          </div>
          <form action={logout} className="px-1 pt-1">
            <button type="submit" className="flex h-9 w-full items-center gap-2.5 rounded-lg px-1.5 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              <LogOut className="text-ink-3" />
              {locale === "sr" ? "Odjavi se" : "Sign out"}
            </button>
          </form>
        </div>
  );

  /* user block: language, currency, sign out */
  // The menu opens upward. On the full sidebar it is shifted right so its icons sit in one
  // vertical line with the chevron of this button; on the icon rail it opens beside it.
  const userBlock = (rail?: boolean, mobile?: boolean) => (
    <Popover
      placement={rail ? "right" : "top"}
      panelStyle={rail ? { bottom: -1 } : mobile ? undefined : { left: "calc(100% - 36.5px)" }}
      label={user.email}
      triggerClassName={cn("group focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-side-2 aria-expanded:bg-side-2", rail && "justify-center")}
      trigger={
        <>
          <UserAvatar email={user.email} size={28} className="shrink-0" />
          {!rail && <span className="min-w-0 flex-1 truncate text-left text-sm text-side-ink">{user.email}</span>}
          {!rail && <ChevronDown size={16} className="shrink-0 text-side-ink-2 transition-transform duration-200 group-aria-expanded:rotate-180" />}
        </>
      }
    >
      {(close) => accountPanel(close)}
    </Popover>
  );

  const full = (mobile?: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 pr-2 pl-3">
        <RoadlineLogo height={20} className="ml-1" />
        {!mobile && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title={locale === "sr" ? "Skupi meni" : "Collapse"}
            className="focus-ring ml-auto grid size-8 place-items-center rounded-lg text-side-ink-3 hover:bg-side-2 hover:text-side-ink"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <nav className="side-scroll mt-3 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {top.map((it) => (
          <Row key={it.href} it={it} />
        ))}
        {groups.map((g) => {
          const open = openGroups[g.key];
          const groupActive = g.items.some((it) => isActive(pathname, it.href));
          const GIcon = g.icon;
          return (
            <div key={g.key} className="pt-2">
              <button
                type="button"
                onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !s[g.key] }))}
                aria-expanded={open}
                className={cn(
                  "focus-ring flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  groupActive && !open ? "bg-side-2 text-white" : "text-side-ink hover:bg-side-2",
                )}
              >
                <GIcon />
                <span className="flex-1 text-left">{t(g.label)}</span>
                {!open && g.items.some((it) => it.badge === "alerts") && alertCount > 0 && <span className={cn("size-1.5 rounded-full", alerts.expired ? "bg-bad" : "bg-warn")} />}
                <ChevronDown className={cn("text-side-ink-3 transition-transform", !open && "-rotate-90")} />
              </button>
              {open && (
                <div className="relative mt-1 ml-[18px] space-y-1 border-l border-side-line pl-2.5">
                  {g.items.map((it) => (
                    <Row key={it.href} it={it} child />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 px-2 pb-3">
        {bottom.map((it) => (
          <Row key={it.href} it={it} />
        ))}
        <div className="mt-2 border-t border-side-line pt-3">{userBlock(false, mobile)}</div>
      </div>
    </div>
  );

  const rail = (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-14 items-center">
        <RoadlineMark size={20} />
      </div>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Expand sidebar"
        title={locale === "sr" ? "Proširi meni" : "Expand"}
        className="focus-ring grid size-9 place-items-center rounded-lg text-side-ink-3 hover:bg-side-2 hover:text-side-ink"
      >
        <PanelLeftOpen size={16} />
      </button>
      <nav className="side-scroll mt-2 flex w-full flex-1 flex-col gap-1 overflow-y-auto pb-4">
        {top.map((it) => (
          <Row key={it.href} it={it} rail />
        ))}
        {groups.map((g) => (
          <div key={g.key} className="mt-2 flex flex-col gap-1 border-t border-side-line pt-3">
            {g.items.map((it) => (
              <Row key={it.href} it={it} rail />
            ))}
          </div>
        ))}
      </nav>
      <div className="flex w-full flex-col gap-1 px-2 pb-3">
        {bottom.map((it) => (
          <Row key={it.href} it={it} rail />
        ))}
        <div className="mt-2 border-t border-side-line pt-2">{userBlock(true)}</div>
      </div>
    </div>
  );

  return (
    <LucideProvider size={16} strokeWidth={1.5}>
      {/* phones: app bar on top … */}
      <div className="sticky top-[var(--bar-h,0px)] z-40 bg-side pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-12 items-center gap-2 px-3">
          {backTarget ? (
            <Link href={backTarget.href} className="focus-ring -ml-1 flex h-[40px] min-w-0 items-center gap-1 rounded-lg pr-2 pl-1 text-[15px] text-side-ink active:bg-side-2">
              <ArrowLeft size={20} className="shrink-0" />
              <span className="truncate">{t(backTarget.label)}</span>
            </Link>
          ) : (
            <RoadlineLogo height={17} className="ml-1" />
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="focus-ring ml-auto flex h-[40px] items-center gap-2 rounded-full pr-1 pl-3 text-side-ink-2 active:bg-side-2"
            aria-label={t("nav.menu")}
          >
            <span className="max-w-[140px] truncate text-xs">{company.name}</span>
            <UserAvatar email={user.email} size={28} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* … and a tab bar at the bottom */}
      <nav
        aria-label={t("nav.menu")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(17,20,39,0.08)] lg:hidden"
      >
        <div className="mx-auto flex h-[60px] max-w-md items-stretch justify-around px-1">
          {tabs.map((it) =>
            it === "add" ? (
              <div key="add" className="grid w-[64px] place-items-center">
                <QuickAdd
                  refs={refs}
                  triggerClassName="focus-ring grid size-[48px] place-items-center rounded-2xl bg-accent text-white shadow-[0_6px_16px_-6px_rgba(5,150,105,0.7)] active:scale-95 transition-transform"
                  trigger={<Plus size={24} strokeWidth={2} />}
                />
              </div>
            ) : (
              <TabLink key={it.href} it={it} />
            ),
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={cn("flex w-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium", mobileOpen || menuActive ? "text-accent-ink" : "text-ink-3")}
          >
            <MenuIcon size={22} strokeWidth={1.75} />
            {t("nav.menu")}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-[rgba(14,16,19,0.4)]" onClick={() => setMobileOpen(false)} />
          <div className="sheet-in absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-panel text-ink">
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden />
            <div className="flex h-12 shrink-0 items-center justify-between px-4">
              <h2 className="text-[17px] font-semibold">{t("nav.menu")}</h2>
              <button type="button" onClick={() => setMobileOpen(false)} className="focus-ring -mr-1.5 grid size-[34px] place-items-center rounded-full bg-surface-3 text-ink-2" aria-label={t("c.close")}>
                <X />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
              {[{ key: "main", label: null as null | NavItem["label"], items: [...top, ...bottom] }, ...groups.map((g) => ({ key: g.key, label: g.label, items: g.items }))].map((g) => (
                <section key={g.key} className="mb-4">
                  {g.label && <h3 className="px-1 pb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">{t(g.label)}</h3>}
                  <div className="grid grid-cols-4 gap-2">
                    {g.items.map((it) => (
                      <Tile key={it.href} it={it} />
                    ))}
                  </div>
                </section>
              ))}
              <section className="rounded-2xl border border-line bg-surface p-1.5">{accountPanel(() => setMobileOpen(false), true)}</section>
            </div>
          </div>
        </div>
      )}
      <aside className={cn("sticky top-[var(--bar-h,0px)] z-30 hidden h-[calc(100dvh-var(--bar-h,0px))] shrink-0 bg-side transition-[width] duration-200 lg:block", collapsed ? "w-16" : "w-[256px]")}>
        {collapsed ? rail : full()}
      </aside>
    </LucideProvider>
  );
}
