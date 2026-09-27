import Link from "@/components/ui/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const cn = clsx;

type BtnVariant = "primary" | "dark" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "icon";

const btnBase =
  "focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-[background,box-shadow,color] disabled:opacity-50 disabled:pointer-events-none select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(35,30,160,0.25)]",
  dark: "bg-ink text-white hover:bg-[#23263a]",
  secondary: "bg-surface text-ink border border-line shadow-xs hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-surface text-bad-ink border border-line shadow-xs hover:bg-bad-soft",
};
const btnSizes: Record<BtnSize, string> = {
  sm: "h-7 px-2.5 rounded-md",
  md: "h-8 px-3 rounded-lg",
  icon: "size-8 rounded-lg",
};

export function btnClass(variant: BtnVariant = "secondary", size: BtnSize = "md", extra?: string) {
  return cn(btnBase, btnVariants[variant], btnSizes[size], extra);
}

export function Button({ variant = "secondary", size = "md", className, ...rest }: ComponentProps<"button"> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button type="button" className={btnClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant = "secondary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: BtnSize }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

/** White card with hairline border (the Purchasing / Spend by Vendor cards). */
export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface shadow-xs", className)} {...rest}>
      {children}
    </div>
  );
}

/** Card with a title row. Title is 13px semibold; the body is free-form. */
export function Shell({
  icon,
  title,
  action,
  children,
  className,
  innerClassName,
  tabbed,
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Title sits in a bordered tab on the card's top edge (Net Promoter Score History style). */
  tabbed?: boolean;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-line bg-surface shadow-xs", className)}>
      <header className={cn("flex min-h-11 items-center gap-2", tabbed ? "border-b border-line pr-3" : "px-4 pt-1")}>
        <div className={cn("flex h-11 items-center gap-2", tabbed && "border-r border-line px-4")}>
          {icon && <span className="text-ink-3">{icon}</span>}
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        {action && <div className="ml-auto flex items-center gap-2 text-xs text-ink-3">{action}</div>}
      </header>
      <div className={cn("min-h-0 flex-1", innerClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, actions, tabs }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-ink">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-4">{tabs}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "bg-surface text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-accent-line",
  good: "bg-good-soft text-good-ink border-good-line",
  warn: "bg-warn-soft text-warn-ink border-warn-line",
  bad: "bg-bad-soft text-bad-ink border-bad-line",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

const dotColor = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", neutral: "bg-ink-4", accent: "bg-accent", info: "bg-info" } as const;
export function Dot({ tone = "neutral", className }: { tone?: keyof typeof dotColor; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", dotColor[tone], className)} />;
}

/** Status label with a leading dot (Complete / In Progress / Planned). */
export function StatusDot({ tone, children }: { tone: keyof typeof dotColor; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-ink-2">
      <Dot tone={tone} />
      {children}
    </span>
  );
}

export function Progress({ value, tone = "accent", className }: { value: number; tone?: "good" | "accent" | "warn" | "bad"; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const color = {
    good: "bg-good",
    accent: "bg-gradient-to-r from-[#4f46e5] to-[#6d68ea]",
    warn: "bg-warn",
    bad: "bg-bad",
  }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-ink-3">{children}</div>;
}

export function Kv({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-ink-3">{label}</span>
      <span className="text-right font-medium text-ink tnum">{children}</span>
    </div>
  );
}
