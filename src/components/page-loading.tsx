import { Loader2 } from "lucide-react";

/** Shown instantly while the next page is loading on the server. */
export function PageLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-ink-3">
        <Loader2 className="animate-spin" /> Učitavanje…
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-xl border border-line bg-surface" />
    </div>
  );
}
