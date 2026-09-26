import Link from "next/link";
import { cn } from "./ui/primitives";

type Seg = { key: string; label: string; count: number; color: string; href?: string };

/** Segmented bar + category table (Response Distribution style). */
export function Distribution({ segments, labels, className }: { segments: Seg[]; labels: { category: string; count: string; total: string }; className?: string }) {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-[3px]" role="img" aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.key} className="h-full rounded-full" style={{ width: `${(s.count / total) * 100}%`, background: s.color, minWidth: 6 }} />
          ))}
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs tracking-[0.04em] text-ink-3 uppercase">
            <th className="h-8 text-left font-medium">{labels.category}</th>
            <th className="w-20 text-right font-medium">{labels.count}</th>
            <th className="w-14 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key}>
              <td className="h-8">
                {s.href ? (
                  <Link href={s.href} className="inline-flex items-center gap-2 text-ink hover:text-accent-ink">
                    <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                    {s.label}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 text-ink">
                    <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                    {s.label}
                  </span>
                )}
              </td>
              <td className="text-right text-ink-2 tnum">{s.count}</td>
              <td className="text-right text-ink-2 tnum">{pct(s.count)}</td>
            </tr>
          ))}
          <tr className={cn("font-semibold")}>
            <td className="h-9 text-xs tracking-[0.04em] uppercase">{labels.total}</td>
            <td className="text-right tnum">{total}</td>
            <td className="text-right tnum">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Colored status columns with dotted leaders (Manufacturing Overview style). */
export function StatusColumns({ segments }: { segments: Seg[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  const shown = segments.filter((s) => s.count > 0);
  const empty = segments.filter((s) => s.count === 0);
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {shown.map((s) => (
          <div key={s.key} className="min-w-[84px]" style={{ flex: `${s.count} 1 0%` }}>
            <div
              className="grid h-7 place-items-center rounded-md text-xs font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
              style={{ background: `linear-gradient(90deg, ${s.color}, color-mix(in srgb, ${s.color} 78%, white))` }}
            >
              {s.count}
            </div>
            <div className="mx-auto h-7 w-px border-l border-dashed" style={{ borderColor: s.color }} />
            <div className="text-center">
              <div className="text-sm font-medium text-ink tnum">
                {s.count} ({Math.round((s.count / total) * 100)}%)
              </div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-2">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                <span className="truncate">{s.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {empty.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-x-10 gap-y-3">
          {empty.map((s) => (
            <div key={s.key} className="text-center">
              <div className="text-sm text-ink-3 tnum">0 (0%)</div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-2">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
