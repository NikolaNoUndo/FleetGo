import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/session";
import { getPrefs } from "@/lib/prefs";
import { PrefsProvider } from "@/components/prefs";
import { RoadlineLogo } from "@/components/brand";
import { AdminLoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  const { locale, currency } = await getPrefs();
  return (
    <PrefsProvider value={{ locale, currency, rate: 117.2, warnDays: 30 }}>
      <div className="flex min-h-dvh flex-col items-center bg-side px-4 pt-16">
        <RoadlineLogo height={24} className="mb-8" />
        <AdminLoginForm />
      </div>
    </PrefsProvider>
  );
}
