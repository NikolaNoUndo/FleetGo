"use client";

import Link from "@/components/ui/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Languages, LucideProvider, LogOut, PanelLeftClose, PanelLeftOpen, UserRound, Wallet, X } from "lucide-react";
import { setPreference, switchCompany } from "@/app/actions";
import { logout } from "@/app/auth-actions";
import { usePrefs } from "./prefs";
import { RoadlineLogo, RoadlineMark } from "./brand";
import { UserAvatar } from "./user-avatar";
import { cn } from "./ui/primitives";
import { Popover, Segmented } from "./ui/client";
import { BOTTOM, GROUPS, TOP, isActive, type NavItem } from "@/lib/nav";
import { FeedbackButton, FeedbackDialog } from "./feedback";
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
}: {
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
  const [feedback, setFeedback] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ tours: true, fleet: true, costs: true });
  const [, start] = useTransition();
  const alertCount = alerts.expired + alerts.soon;
  // MobileShell's menu button asks for the drawer
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener("rl:open-menu", open);
    return () => window.removeEventListener("rl:open-menu", open);
  }, []);
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
      {(close) => (
        <div className="w-[256px]">
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
      )}
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
        <FeedbackButton
          onClick={() => {
            setMobileOpen(false);
            setFeedback(true);
          }}
        />
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
        <FeedbackButton rail onClick={() => setFeedback(true)} />
        {bottom.map((it) => (
          <Row key={it.href} it={it} rail />
        ))}
        <div className="mt-2 border-t border-side-line pt-2">{userBlock(true)}</div>
      </div>
    </div>
  );

  return (
    <LucideProvider size={16} strokeWidth={1.5}>
      {/* phones and tablets: the app bar and tab bar are in MobileShell; its menu button opens this drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="drawer-in absolute inset-y-0 left-0 w-[288px] max-w-[85vw] bg-side pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute top-[calc(env(safe-area-inset-top)+12px)] right-3 z-10 grid size-8 place-items-center rounded-lg text-side-ink-2 hover:bg-side-2" aria-label={t("c.close")}>
              <X />
            </button>
            {full(true)}
          </aside>
        </div>
      )}
      <aside className={cn("sticky top-[var(--bar-h,0px)] z-30 hidden h-[calc(100dvh-var(--bar-h,0px))] shrink-0 bg-side transition-[width] duration-200 lg:block", collapsed ? "w-16" : "w-[256px]")}>
        {collapsed ? rail : full()}
      </aside>
      <FeedbackDialog open={feedback} onClose={() => setFeedback(false)} />
    </LucideProvider>
  );
}
