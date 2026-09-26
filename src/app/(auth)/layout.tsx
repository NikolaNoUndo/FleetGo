import { getPrefs } from "@/lib/prefs";
import { PrefsProvider } from "@/components/prefs";
import { RoadlineLogo } from "@/components/brand";
import { AuthLocaleSwitch } from "@/components/auth-forms";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { locale, currency } = await getPrefs();
  return (
    <PrefsProvider value={{ locale, currency, rate: 117.2, warnDays: 30 }}>
      <div className="flex min-h-dvh flex-col bg-bg">
        <header className="flex h-16 items-center justify-between px-5 sm:px-8">
          <RoadlineLogo dark />
          <AuthLocaleSwitch />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">{children}</main>
        <footer className="pb-6 text-center text-xs text-ink-4">© {new Date().getFullYear()} Roadline</footer>
      </div>
    </PrefsProvider>
  );
}
