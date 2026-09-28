/** A shop or fuel station shown on the live map. */
export type MapPlace = {
  id: string;
  kind: "shop" | "pump";
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  note: string | null;
  supplierId: string | null;
  supplierName: string | null;
  phone: string | null;
};
