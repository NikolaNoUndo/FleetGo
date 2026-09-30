import { cookies } from "next/headers";
import { getPrefs } from "@/lib/prefs";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { companyRate } from "@/lib/fx";
import { getAlertCounts, getRefs } from "@/lib/queries";
import { PrefsProvider } from "@/components/prefs";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ImpersonationBar } from "@/components/impersonation-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const [{ locale, currency }, { refs }, c, rate] = await Promise.all([getPrefs(), getRefs(), cookies(), companyRate(ctx.company)]);
  const alerts = can(ctx.perms, "documents") ? await getAlertCounts() : { expired: 0, soon: 0 };
  const collapsed = c.get("rl_sidebar")?.value === "collapsed";
  return (
    <PrefsProvider value={{ locale, currency, rate, warnDays: ctx.company.warnDays, perms: ctx.perms, isOwner: ctx.isOwner }}>
      {ctx.impersonating && <ImpersonationBar email={ctx.user.email} company={ctx.company.name} />}
      <div className="flex min-h-[calc(100dvh-var(--bar-h))] flex-col bg-side lg:flex-row" style={{ "--bar-h": ctx.impersonating ? "36px" : "0px" } as React.CSSProperties}>
        <Sidebar
          company={{ id: ctx.company.id, name: ctx.company.name }}
          companies={ctx.companies.map((x) => ({ id: x.id, name: x.name, role: x.role }))}
          user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.membership.role }}
          alerts={alerts}
          collapsed={collapsed}
          refs={refs}
        />
        <main className="flex min-w-0 flex-1 flex-col bg-bg lg:my-2 lg:mr-2 lg:rounded-2xl">
          <Topbar refs={refs} />
          {/* phones: edge to edge, with room for the tab bar at the bottom */}
          <div className="flex-1 bg-panel sm:bg-transparent sm:px-3 sm:pt-3 sm:pb-3 lg:pt-0">
            <div className="min-h-full sm:rounded-2xl sm:border sm:border-line sm:bg-panel sm:shadow-xs">
              <div className="mx-auto w-full max-w-[1360px] px-3 pt-4 pb-[calc(84px+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 lg:pb-8">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </PrefsProvider>
  );
}
