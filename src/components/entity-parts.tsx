import { expiryState } from "@/lib/format";

/** "125 used / 500 available"-style meter for how many documents are currently valid. */
export function DocsMeter({ docs, warnDays, locale }: { docs: { expiresAt: string | null }[]; warnDays: number; locale: "sr" | "en" }) {
  const states = docs.map((d) => expiryState(d.expiresAt, warnDays));
  const ok = states.filter((s) => s === "ok").length;
  const soon = states.filter((s) => s === "soon").length;
  const expired = states.filter((s) => s === "expired").length;
  const total = docs.length || 1;
  return (
    <div className="px-4 pt-1 pb-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-3">
          <span className="font-semibold text-ink tnum">{ok}</span> {locale === "sr" ? "važi" : "valid"} /{" "}
          <span className="font-semibold text-ink tnum">{docs.length}</span> {locale === "sr" ? "ukupno" : "total"}
        </span>
        <span className="text-xs text-ink-3 tnum">
          {expired > 0 && <span className="text-bad">{expired} {locale === "sr" ? "isteklo" : "expired"}</span>}
          {expired > 0 && soon > 0 && " · "}
          {soon > 0 && <span className="text-warn">{soon} {locale === "sr" ? "uskoro" : "soon"}</span>}
        </span>
      </div>
      <div className="flex h-2 w-full gap-[3px]" role="img" aria-label={`${ok}/${docs.length}`}>
        {ok > 0 && <div className="h-full rounded-full bg-good" style={{ width: `${(ok / total) * 100}%` }} />}
        {soon > 0 && <div className="h-full rounded-full bg-warn" style={{ width: `${(soon / total) * 100}%` }} />}
        {expired > 0 && <div className="h-full rounded-full bg-bad" style={{ width: `${(expired / total) * 100}%` }} />}
        {docs.length === 0 && <div className="h-full flex-1 rounded-full bg-surface-3" />}
      </div>
    </div>
  );
}
