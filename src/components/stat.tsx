import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./ui/primitives";
import { InfoTip } from "./ui/client";
import { Sparkline } from "./charts/sparkline";

/** Inline KPIs laid straight on the panel (Net Promoter Score / Total Responses style). */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-8 grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4", className)}>{children}</div>;
}

export function Stat({
  label,
  value,
  delta,
  deltaTone = "neutral",
  sub,
  info,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "good" | "bad" | "neutral" | "warn";
  sub?: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-sm text-ink-2">
        <span className="truncate">{label}</span>
        {info && <InfoTip>{info}</InfoTip>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-xl font-semibold tracking-[-0.01em] text-ink tnum">{value}</span>
        {delta && (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md border px-1.5 text-xs font-medium tnum",
              deltaTone === "good" && "border-good-line bg-good-soft text-good-ink",
              deltaTone === "bad" && "border-bad-line bg-bad-soft text-bad-ink",
              deltaTone === "warn" && "border-warn-line bg-warn-soft text-warn-ink",
              deltaTone === "neutral" && "border-line bg-surface text-ink-2",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

/** KPI card with a trend line (Open Purchase Order / YTD Spend style). */
export function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  trendUpIsGood = true,
  spark,
  sub,
  href,
  flatLabel = "bez promene",
}: {
  label: ReactNode;
  value: ReactNode;
  trend?: { pct: number } | null;
  trendLabel?: string;
  trendUpIsGood?: boolean;
  spark?: number[];
  sub?: ReactNode;
  href?: string;
  flatLabel?: string;
}) {
  const flat = !trend || Math.abs(trend.pct) < 1;
  const up = !!trend && trend.pct > 0;
  const good = flat ? null : up === trendUpIsGood;
  const tone = good === null ? "neutral" : good ? "good" : "bad";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        {trend !== undefined && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-3">
            {flat ? (
              flatLabel
            ) : (
              <>
                <span className={cn("inline-flex items-center gap-0.5 font-medium tnum", good ? "text-good-ink" : "text-bad-ink")}>
                  {up ? <ArrowUp size={12} strokeWidth={2.2} /> : <ArrowDown size={12} strokeWidth={2.2} />}
                  {Math.abs(Math.round(trend!.pct))}%
                </span>
                {trendLabel}
              </>
            )}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0 pb-0.5">
          <div className={cn("text-xl font-semibold tracking-[-0.01em] tnum", tone === "bad" ? "text-bad-ink" : "text-ink")}>{value}</div>
          {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} tone={tone === "neutral" ? "neutral" : tone} width={112} height={44} />}
      </div>
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-5 shadow-xs";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-line-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
