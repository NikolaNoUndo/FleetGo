import Link from "@/components/ui/link";

type Row = { key: string; label: string; sub?: string; value: number; display: string; href?: string };

/** Horizontal bars with the value printed after the bar (Spend by Vendor style). */
export function HBars({ rows, hue = "indigo" }: { rows: Row[]; hue?: "indigo" | "green" }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const [from, to] = hue === "indigo" ? ["#059669", "#34c794"] : ["#4f46e5", "#7c78ee"];
  return (
    <ul className="space-y-3.5 px-4 pt-1 pb-4">
      {rows.map((r, i) => {
        const w = Math.max(4, (r.value / max) * 100);
        const inner = (
          <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{r.label}</div>
              {r.sub && <div className="truncate text-xs text-ink-3">{r.sub}</div>}
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="h-6 shrink rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
                style={{ width: `calc(${w}% - 72px)`, minWidth: 8, background: `linear-gradient(90deg, ${from}, ${to})`, opacity: 1 - i * 0.1 }}
              />
              <span className="shrink-0 text-sm font-medium whitespace-nowrap text-ink tnum">{r.display}</span>
            </div>
          </div>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} className="-mx-2 block rounded-lg px-2 py-0.5 hover:bg-surface-2">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
