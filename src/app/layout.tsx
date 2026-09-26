import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { getPrefs } from "@/lib/prefs";
import { getCompany } from "@/lib/tenant";
import { getAlertCounts } from "@/lib/queries";
import { PrefsProvider } from "@/components/prefs";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: { default: "FleetGo", template: "%s · FleetGo" },
  description: "Upravljanje voznim parkom za prevozničke i logističke firme.",
};

export const viewport: Viewport = { themeColor: "#fafafa" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ locale, currency }, company, alerts] = await Promise.all([getPrefs(), getCompany(), getAlertCounts()]);
  return (
    <html lang={locale === "sr" ? "sr-Latn" : "en"} className="h-full">
      <body className="min-h-full">
        <PrefsProvider value={{ locale, currency, rate: company.eurRsdRate, warnDays: company.warnDays }}>
          <div className="flex min-h-dvh flex-col lg:flex-row">
            <Sidebar company={company.name} alerts={alerts} />
            <main className="min-w-0 flex-1">
              <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
            </main>
          </div>
        </PrefsProvider>
      </body>
    </html>
  );
}
