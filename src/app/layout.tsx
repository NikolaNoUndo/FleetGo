import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { getPrefs } from "@/lib/prefs";

export const metadata: Metadata = {
  title: { default: "Roadline", template: "%s · Roadline" },
  description: "Upravljanje voznim parkom za prevozničke i logističke firme.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0e1013" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getPrefs();
  return (
    <html lang={locale === "sr" ? "sr-Latn" : "en"} className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
