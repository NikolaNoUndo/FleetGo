import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { requireAccess } from "@/lib/auth/context";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { LiveView } from "@/components/map/live-view";
import { getT, getPrefs } from "@/lib/prefs";
import { listPlaces } from "@/lib/queries";
import type { MapPlace } from "@/lib/places";

export const metadata: Metadata = { title: "Mapa uživo" };

export default async function LivePage() {
  const ctx = await requireAccess("live");
  const [t, { locale }, places] = await Promise.all([getT(), getPrefs(), listPlaces()]);
  const c = ctx.company;
  const hq: MapPlace | null =
    c.hqLat !== null && c.hqLng !== null
      ? { id: "hq", kind: "hq", name: c.name, address: c.address, lat: c.hqLat, lng: c.hqLng, note: null, supplierId: null, supplierName: null, phone: null, ownPhone: null, dieselPrice: null, priceCurrency: null, priceUpdatedAt: null }
      : null;
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
      <LiveView places={places} hq={hq} />
    </>
  );
}
