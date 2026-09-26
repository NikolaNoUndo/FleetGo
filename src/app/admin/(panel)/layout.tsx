import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { getPrefs } from "@/lib/prefs";
import { PrefsProvider } from "@/components/prefs";
import { RoadlineLogo } from "@/components/brand";
import { adminLogout } from "../actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { currency } = await getPrefs();
  return (
    <PrefsProvider value={{ locale: "sr", currency, rate: 117.2, warnDays: 30 }}>
      <div className="min-h-dvh bg-bg">
        <header className="flex h-14 items-center gap-3 bg-side px-4 sm:px-6">
          <RoadlineLogo />
          <span className="rounded border border-side-line px-1.5 text-xs font-medium text-side-ink-2">Admin</span>
          <form action={adminLogout} className="ml-auto">
            <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-side-ink-2 hover:bg-side-2 hover:text-white">
              <LogOut /> Odjava
            </button>
          </form>
        </header>
        <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </PrefsProvider>
  );
}
