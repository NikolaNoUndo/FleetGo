import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { requireAccess } from "@/lib/auth/context";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { LiveView } from "@/components/map/live-view";
import { getT, getPrefs } from "@/lib/prefs";
import { listPlaces } from "@/lib/queries";

export const metadata: Metadata = { title: "Mapa uživo" };

export default async function LivePage() {
  await requireAccess("live");
  const [t, { locale }, places] = await Promise.all([getT(), getPrefs(), listPlaces()]);
  return (
    <>
      <PageHeader
        title={t("p.live.title")}
        sub={t("p.live.sub")}
        actions={
          <ButtonLink href="/live/places" size="sm">
            <MapPin /> {locale === "sr" ? "Lokacije" : "Places"}
            <span className="text-ink-3 tnum">{places.length}</span>
          </ButtonLink>
        }
      />
      <LiveView places={places} />
    </>
  );
}
