import type { Currency } from "./countries";

/** One country (or priced stretch, "PL-A2") on a tour: km driven on tolled roads and what that costs. */
export type TollPart = {
  country: string;
  km: number;
  /** amount in EUR (converted from RSD/HUF where the toll is paid in those) */
  eur: number;
  /** the rate used, in the country's own currency per km */
  rate: number;
  rateCurrency: Currency;
  /** paid by days (a vignette) instead of by km: how many days */
  days?: number;
  /** how it was worked out: by km on tolled roads, from the official entry–exit price list, or a vignette */
  method?: "km" | "ramp" | "vignette";
  /** ramp to ramp: each stretch with its entry and exit station and official price (in rateCurrency) */
  trips?: { from: string; to: string; price: number; km: number }[];
  /** the rate for this vehicle class is our estimate, not from a price list */
  estimated?: boolean;
};

/** A tour's tolls worked out from its track. Stored on the tour as JSON. */
export type TollCalc = {
  /** when it was calculated (ISO) */
  at: string;
  totalEur: number;
  parts: TollPart[];
  /** total axles used (truck + trailer) and the truck's EURO class */
  axles: number;
  euro: string | null;
  /** track points used, and km of the whole track */
  points: number;
  trackKm: number;
  /** the period the track was taken for (ISO) */
  from: string;
  to: string;
  /** truck and trailer it was worked out for */
  vehicleId: string;
  trailerId: string | null;
  /** countries we saw the truck in whose network is not loaded yet */
  notes?: string[];
};
