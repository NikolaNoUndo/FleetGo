import { cn } from "./ui/primitives";

/** Roadline mark: a road narrowing to the horizon. */
export function RoadlineMark({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", dark ? "bg-ink text-white" : "bg-white text-side", className)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
        <path d="M6.5 21 10.5 3" />
        <path d="M17.5 21 13.5 3" />
        <path d="M12 16v3M12 10.5v2.5M12 6v2" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

export function RoadlineLogo({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <RoadlineMark dark={dark} />
      <span className={cn("text-sm font-semibold tracking-[-0.01em]", dark ? "text-ink" : "text-white")}>Roadline</span>
    </span>
  );
}
