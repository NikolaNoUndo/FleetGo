/** parts shop, workshop, fuel station, our own head office, our own parking / yard */
export type PlaceKind = "shop" | "service" | "pump" | "hq" | "parking";
export const PLACE_KIND_LIST: PlaceKind[] = ["pump", "shop", "service", "hq", "parking"];
export const asPlaceKind = (k: string): PlaceKind => ((PLACE_KIND_LIST as string[]).includes(k) ? (k as PlaceKind) : "shop");

/** A parts shop, workshop or fuel station shown on the live map. */
export type MapPlace = {
  id: string;
  kind: PlaceKind;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  note: string | null;
  supplierId: string | null;
  supplierName: string | null;
  /** the place's own phone, else its supplier's */
  phone: string | null;
  /** phone typed on the place itself (for the edit form) */
  ownPhone: string | null;
  /** fuel stations only */
  dieselPrice: number | null;
  priceCurrency: string | null;
  /** ISO timestamp of the last price change */
  priceUpdatedAt: string | null;
};
