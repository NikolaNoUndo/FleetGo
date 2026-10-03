/**
 * A tour's way from its legs: "Čačak → Beograd → Kraljevo → Čačak". A leg starting
 * somewhere else than where the last one ended adds that place too. Safe on server and client.
 */
export function legsRoute(legs: { fromPlace: string | null; toPlace: string | null }[]) {
  const pts: string[] = [];
  for (const l of legs) {
    const from = l.fromPlace?.trim();
    const to = l.toPlace?.trim();
    if (from && pts.at(-1)?.toLowerCase() !== from.toLowerCase()) pts.push(from);
    if (to) pts.push(to);
  }
  return pts.join(" → ") || "—";
}

/** One leg: "Čačak → Beograd". */
export const legRoute = (l: { fromPlace: string | null; toPlace: string | null }) => [l.fromPlace, l.toPlace].filter(Boolean).join(" → ") || "—";
