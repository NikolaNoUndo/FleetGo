/** "Beograd → München" (or "—" when neither end is written). Safe on server and client. */
export const tourRoute = (r: { fromPlace: string | null; toPlace: string | null }) => [r.fromPlace, r.toPlace].filter(Boolean).join(" → ") || "—";
