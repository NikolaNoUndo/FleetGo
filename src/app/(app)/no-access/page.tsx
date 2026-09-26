import Link from "next/link";
import { Lock } from "lucide-react";
import { getPrefs } from "@/lib/prefs";

export default async function NoAccessPage() {
  const { locale } = await getPrefs();
  const sr = locale === "sr";
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-surface-3 text-ink-2">
        <Lock size={18} />
      </span>
      <h1 className="mt-4 text-xl font-semibold">{sr ? "Nemaš pristup ovom delu" : "You don't have access here"}</h1>
      <p className="mt-2 text-sm text-ink-3">
        {sr ? "Vlasnik firme određuje šta koji član vidi. Ako ti ovo treba, javi mu se." : "Your company owner decides who sees what. Ask them if you need this."}
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent-ink hover:underline">
        {sr ? "Nazad na početnu" : "Back to start"}
      </Link>
    </div>
  );
}
