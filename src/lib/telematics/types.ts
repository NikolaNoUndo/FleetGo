export type TrackedVehicle = {
  id: string;
  plate: string;
  wialonUnitId: string | null;
  driverName: string | null;
  status?: string;
};

export type Position = {
  unitId: string;
  unitName: string;
  vehicleId: string | null;
  lat: number;
  lng: number;
  speed: number; // km/h
  course: number; // degrees
  ts: number; // ms epoch of the last fix
  state: "moving" | "stopped" | "offline";
  place?: string;
};

export type PositionsResult = {
  source: "simulation" | "wialon";
  positions: Position[];
  error?: string;
  fetchedAt: number;
};
