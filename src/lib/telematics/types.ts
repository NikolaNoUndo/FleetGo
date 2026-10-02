export type TrackedVehicle = {
  id: string;
  plate: string;
  wialonUnitId: string | null;
  driverName: string | null;
  status?: string;
};

export type Position = {
  unitId: string;
  /** device unique ID (IMEI) from Wialon, when available */
  uid?: string | null;
  unitName: string;
  vehicleId: string | null;
  lat: number;
  lng: number;
  speed: number; // km/h
  course: number; // degrees
  ts: number; // ms epoch of the last fix
  state: "moving" | "stopped" | "offline";
  place?: string;
  /** odometer from tracking, km: the truck's own (CAN / mileage sensor) or Wialon's mileage counter */
  mileageKm?: number | null;
  /** where mileageKm came from: "can" = the truck's odometer in the last message, "counter" = Wialon's mileage counter */
  mileageSrc?: "can" | "counter" | null;
};

export type WialonConfig = { token: string | null; host: string | null };

export type PositionsResult = {
  /** wialon = live data · none = no token for this company · error = Wialon did not answer */
  source: "wialon" | "none" | "error";
  positions: Position[];
  error?: string;
  fetchedAt: number;
};
