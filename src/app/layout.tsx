import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { getPrefs } from "@/lib/prefs";
import { getCompany } from "@/lib/tenant";
import { getAlertCounts, getRefs } from "@/lib/queries";
import { PrefsProvider } from "@/components/prefs";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export const metadata: Metadata = {
  title: { default: "FleetGo", template: "%s · FleetGo" },
  description: "Upravljanje voznim parkom za prevozničke i logističke firme.",
};

export const viewport: Viewport = { themeColor: "#0e1013" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ locale, currency }, company, alerts, { refs }, c] = await Promise.all([getPrefs(), getCompany(), getAlertCounts(), getRefs(), cookies()]);
  const collapsed = c.get("fg_sidebar")?.value === "collapsed";
  return (
    <html lang={locale === "sr" ? "sr-Latn" : "en"} className="h-full">
      <body className="min-h-full">
        <PrefsProvider value={{ locale, currency, rate: company.eurRsdRate, warnDays: company.warnDays }}>
          <div className="flex min-h-dvh flex-col bg-side lg:flex-row">
            <Sidebar company={company.name} alerts={alerts} collapsed={collapsed} />
            <main className="flex min-w-0 flex-1 flex-col bg-bg lg:my-2 lg:mr-2 lg:rounded-2xl">
              <Topbar refs={refs} />
              <div className="flex-1 px-2 pb-2 sm:px-3 sm:pb-3">
                <div className="min-h-full rounded-2xl border border-line bg-panel shadow-xs">
                  <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-7">{children}</div>
                </div>
              </div>
            </main>
          </div>
        </PrefsProvider>
      </body>
    </html>
  );
}
