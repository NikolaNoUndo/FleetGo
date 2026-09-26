import type { ReactNode } from "react";
import { cn } from "./ui/primitives";

export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}

export function Stat({
  label,
  value,
  delta,
  deltaTone = "neutral",
  sub,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "good" | "bad" | "neutral" | "warn";
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4 shadow-xs sm:px-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
        {icon && <span className="[&>svg]:size-4">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[24px] leading-none font-semibold tracking-[-0.02em] text-ink tnum sm:text-[26px]">{value}</span>
        {delta && (
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-[7px] border px-1.5 text-[12px] font-medium tnum",
              deltaTone === "good" && "border-[#c9ecd5] bg-good-soft text-[#157a3a]",
              deltaTone === "bad" && "border-[#f6cbc7] bg-bad-soft text-[#b42318]",
              deltaTone === "warn" && "border-[#f5dfb0] bg-warn-soft text-[#9a5b00]",
              deltaTone === "neutral" && "border-line bg-surface-2 text-ink-2",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-2 text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  );
}
