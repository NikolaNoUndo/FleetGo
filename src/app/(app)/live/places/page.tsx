import type { Metadata } from "next";
import { Map as MapIcon } from "lucide-react";
import { requireAccess } from "@/lib/auth/context";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { PlacesTable } from "@/components/tables/places";
import { getPrefs } from "@/lib/prefs";
import { listPlaces, listSuppliers } from "@/lib/queries";

export const metadata: Metadata = { title: "Lokacije na mapi" };

export default async function PlacesPage() {
  await requireAccess("live");
  const [{ locale }, places, suppliers] = await Promise.all([getPrefs(), listPlaces(), listSuppliers()]);
  const sr = locale === "sr";
  const rows = places.map((p) => ({ ...p, coords: `${p.lat}, ${p.lng}` }));
  const refs = { suppliers: suppliers.map((s) => ({ id: s.id, label: s.name })) };
  return (
    <>
      <PageHeader
        title={sr ? "Lokacije na mapi" : "Places on the map"}
        sub={
          sr
            ? "Prodavnice, servisi i pumpe koje se mogu uključiti na Mapi uživo (gore desno)."
            : "Shops, workshops and fuel stations you can switch on in the Live map (top right)."
        }
        actions={
          <ButtonLink href="/live" size="sm">
            <MapIcon /> {sr ? "Nazad na mapu" : "Back to map"}
          </ButtonLink>
        }
      />
      <PlacesTable rows={rows} refs={refs} />
    </>
  );
}
