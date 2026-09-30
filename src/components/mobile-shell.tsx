"use client";

import Link from "@/components/ui/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, Bell, ChevronRight, House, Languages, LogOut, Map as MapIcon, Menu as MenuIcon, Plus, Receipt, Truck, UserRound, Wallet, X } from "lucide-react";
import { setPreference, switchCompany } from "@/app/actions";
import { logout } from "@/app/auth-actions";
import { usePrefs } from "./prefs";
import { UserAvatar } from "./user-avatar";
import { QuickAdd } from "./topbar";
import { cn } from "./ui/primitives";
import { Segmented } from "./ui/client";
import { BOTTOM, GROUPS, TOP, crumbsFor, isActive, type NavItem } from "@/lib/nav";
import type { Refs } from "@/lib/resources";
import { ROLES, ROUTE_MODULE } from "@/lib/auth/permissions";

type Company = { id: string; name: string; role?: string };
type UserInfo = { name: string | null; email: string; role: string };

const DETAIL = /^\/(vehicles|trailers|employees)\/[^/]+$/;
const circle = "focus-ring relative grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition-colors active:bg-surface-3";

/**
 * Phones and tablets (below lg): a light app bar with the page title between two round
 * buttons, a tab bar with four icons, a black "+" pill floating above it and a menu
 * sheet with everything else. Desktop keeps the sidebar.
 */
export function MobileShell({
  company,
  companies,
  user,
  alerts,
  refs,
}: {
  company: Company;
  companies: Company[];
  user: UserInfo;
  alerts: { expired: number; soon: number };
  refs: Refs;
}) {
  const { t, locale, currency, can } = usePrefs();
  const sr = locale === "sr";
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const alertCount = alerts.expired + alerts.soon;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const allowed = (it: NavItem) => {
    const m = ROUTE_MODULE[it.href];
    return !m || can(m);
  };
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label[locale] ?? user.role;

  // title: the page's own name; detail pages go back to their list
  const crumbs = crumbsFor(pathname);
  const last = crumbs.at(-1);
  const detail = DETAIL.test(pathname) || pathname.startsWith("/live/places");
  const back = detail && last?.href ? { href: last.href, label: last.label } : null;
  const title = last ? t(last.label) : "Roadline";

  // tab bar: Pregled, Mapa, Flota, Troškovi
  const fleet = groups.find((g) => g.key === "fleet");
  const costs = groups.find((g) => g.key === "costs");
  const tabs = [
    allowed(TOP[0]) && { key: "home", href: "/", label: t("nav.overview"), icon: House, active: pathname === "/" },
    allowed(TOP[1]) && { key: "live", href: "/live", label: t("nav.live"), icon: MapIcon, active: isActive(pathname, "/live") },
    fleet && { key: "fleet", href: fleet.items[0].href, label: t("nav.fleet"), icon: Truck, active: fleet.items.some((it) => isActive(pathname, it.href)) },
    costs && { key: "costs", href: costs.items[0].href, label: t("nav.costs"), icon: Receipt, active: costs.items.some((it) => isActive(pathname, it.href)) },
  ].filter(Boolean) as { key: string; href: string; label: string; icon: typeof House; active: boolean }[];

  const setPref = (key: "locale" | "currency", v: string) =>
    start(async () => {
      await setPreference(key, v);
      router.refresh();
    });
  const goCompany = (id: string) =>
    start(async () => {
      setOpen(false);
      await switchCompany(id);
      router.push("/");
      router.refresh();
    });

  const navRow = (it: NavItem) => {
    const Icon = it.icon;
    return (
      <SheetRow
        key={it.href}
        href={it.href}
        active={isActive(pathname, it.href)}
        onNavigate={() => setOpen(false)}
        icon={<Icon />}
        label={t(it.label)}
        badge={it.badge === "alerts" ? <Count n={alertCount} bad={alerts.expired > 0} /> : null}
      />
    );
  };

  return (
    <>
      {/* app bar */}
      <header className="sticky top-[var(--bar-h,0px)] z-40 bg-surface pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-[68px] items-center gap-3 px-5">
          {back ? (
            <Link href={back.href} className={circle} aria-label={t(back.label)}>
              <ArrowLeft size={20} strokeWidth={1.9} />
            </Link>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className={circle} aria-label={t("nav.menu")}>
              <MenuIcon size={20} strokeWidth={1.9} />
            </button>
          )}
          <div className="min-w-0 flex-1 truncate text-[22px] leading-7 font-bold tracking-[-0.025em] text-ink">{back ? t(back.label) : title}</div>
          {can("documents") && (
            <Link href="/documents" className={circle} aria-label={t("nav.documents")}>
              <Bell size={20} strokeWidth={1.9} />
              <Count n={alertCount} bad={alerts.expired > 0} className="absolute -top-0.5 -right-0.5 ring-2 ring-surface" />
            </Link>
          )}
        </div>
      </header>

      {/* tab bar + the "+" pill above it */}
      <nav aria-label={t("nav.menu")} className="fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line)] lg:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-label={tab.label}
                aria-current={tab.active ? "page" : undefined}
                className={cn("relative grid h-16 w-16 place-items-center transition-colors", tab.active ? "text-ink" : "text-ink-4")}
              >
                <Icon size={25} strokeWidth={tab.active ? 2.1 : 1.7} />
                <span className={cn("absolute bottom-2.5 size-1 rounded-full bg-accent transition-opacity", tab.active ? "opacity-100" : "opacity-0")} />
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+52px)] left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <QuickAdd
          refs={refs}
          triggerClassName="focus-ring grid h-[54px] w-[78px] place-items-center rounded-full bg-ink text-white shadow-[0_12px_28px_-10px_rgba(17,20,39,0.55)] transition-transform active:scale-95"
          trigger={<Plus size={26} strokeWidth={2} />}
        />
      </div>

      {/* menu sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-[rgba(14,16,19,0.36)]" onClick={() => setOpen(false)} />
          <div className="sheet-in absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-surface text-ink">
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
            <div className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-2">
              <UserAvatar email={user.email} size={44} className="shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{company.name}</div>
                <div className="truncate text-[13px] text-ink-3">
                  {user.email} · {roleLabel}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className={cn(circle, "size-10")} aria-label={t("c.close")}>
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-3 pb-[calc(20px+env(safe-area-inset-bottom))]">
              {companies.length > 1 && (
                <Section label={sr ? "Promeni firmu" : "Switch company"}>
                  {companies
                    .filter((c) => c.id !== company.id)
                    .map((c) => (
                      <SheetRow key={c.id} icon={<span className="text-[12px] font-semibold">{c.name.slice(0, 2).toUpperCase()}</span>} label={c.name} onClick={() => goCompany(c.id)} />
                    ))}
                </Section>
              )}
              <Section>{TOP.filter(allowed).map(navRow)}</Section>
              {groups.map((g) => (
                <Section key={g.key} label={t(g.label)}>
                  {g.items.map(navRow)}
                </Section>
              ))}
              <Section label={sr ? "Nalog" : "Account"}>
                {BOTTOM.filter(allowed).map(navRow)}
                <SheetRow
                  href="/profile"
                  active={isActive(pathname, "/profile")}
                  onNavigate={() => setOpen(false)}
                  icon={<UserRound />}
                  label={sr ? "Profil i bezbednost" : "Profile & security"}
                />
                <div className="flex h-14 items-center gap-3.5 px-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2 [&_svg]:size-[19px]">
                    <Languages />
                  </span>
                  <span className="flex-1 text-[15px]">{t("c.language")}</span>
                  <Segmented value={locale} onChange={(v) => setPref("locale", v)} items={[{ value: "sr", label: "SR" }, { value: "en", label: "EN" }]} />
                </div>
                <div className="flex h-14 items-center gap-3.5 px-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2 [&_svg]:size-[19px]">
                    <Wallet />
                  </span>
                  <span className="flex-1 text-[15px]">{sr ? "Valuta" : "Currency"}</span>
                  <Segmented value={currency} onChange={(v) => setPref("currency", v)} items={[{ value: "EUR", label: "EUR" }, { value: "RSD", label: "RSD" }]} />
                </div>
                <form action={logout}>
                  <button type="submit" className="flex h-14 w-full items-center gap-3.5 rounded-2xl px-2 text-left text-[15px] text-bad-ink active:bg-surface-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-bad-soft [&_svg]:size-[19px]">
                      <LogOut />
                    </span>
                    {sr ? "Odjavi se" : "Sign out"}
                  </button>
                </form>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Count({ n, bad, className }: { n: number; bad: boolean; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold text-white tnum", bad ? "bg-bad" : "bg-warn", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      {label && <h3 className="px-2 pb-1 text-[13px] font-medium text-ink-3">{label}</h3>}
      {children}
    </section>
  );
}

/** One line of the menu sheet: icon tile, label, badge, chevron. */
function SheetRow({
  href,
  active,
  onNavigate,
  onClick,
  icon,
  label,
  badge,
}: {
  href?: string;
  active?: boolean;
  onNavigate?: () => void;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
}) {
  const inner = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-[19px]", active ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2")}>{icon}</span>
      <span className={cn("min-w-0 flex-1 truncate text-[15px] text-ink", active && "font-semibold")}>{label}</span>
      {badge}
      <ChevronRight size={18} className="shrink-0 text-ink-4" />
    </>
  );
  const cls = "flex h-14 w-full items-center gap-3.5 rounded-2xl px-2 text-left active:bg-surface-2";
  return href ? (
    <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
