import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const cn = clsx;

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type BtnSize = "sm" | "md" | "icon";

const btnBase =
  "focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background,box-shadow,color,transform] active:translate-y-px disabled:opacity-50 disabled:pointer-events-none select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-ink text-white hover:bg-[#2a2a2a] shadow-xs",
  accent: "bg-accent text-white hover:bg-accent-ink shadow-xs",
  secondary: "raised text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "raised text-bad hover:bg-bad-soft",
};
const btnSizes: Record<BtnSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[9px]",
  md: "h-9 px-3.5 text-sm rounded-[10px]",
  icon: "h-9 w-9 rounded-[10px]",
};

export function btnClass(variant: BtnVariant = "secondary", size: BtnSize = "md", extra?: string) {
  return cn(btnBase, btnVariants[variant], btnSizes[size], extra);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button type="button" className={btnClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: BtnSize }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

/** White card with hairline border. */
export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-xs", className)} {...rest}>
      {children}
    </div>
  );
}

/** Tinted outer shell with a header, holding a white inner card (the "Devices" pattern). */
export function Shell({
  icon,
  title,
  action,
  children,
  className,
  innerClassName,
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <section className={cn("rounded-[18px] border border-line bg-surface-2 p-1.5 shadow-xs", className)}>
      <header className="flex min-h-11 items-center gap-2.5 px-3 py-2">
        {icon && <span className="text-ink-2 [&>svg]:size-[18px]">{icon}</span>}
        <h2 className="text-[15px] font-medium text-ink-2">{title}</h2>
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </header>
      <div className={cn("rounded-[13px] border border-line bg-surface", innerClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, actions, crumbs }: { title: string; sub?: string; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && <div className="mb-2 flex items-center gap-1.5 text-[13px] text-ink-3">{crumbs}</div>}
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-[#cfe0fb]",
  good: "bg-good-soft text-[#157a3a] border-[#c9ecd5]",
  warn: "bg-warn-soft text-[#9a5b00] border-[#f5dfb0]",
  bad: "bg-bad-soft text-[#b42318] border-[#f6cbc7]",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-[7px] border px-2 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Progress({ value, tone = "good", className }: { value: number; tone?: "good" | "accent" | "warn" | "bad"; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const color = { good: "bg-[#0aa13e]", accent: "bg-accent", warn: "bg-[#e19a06]", bad: "bg-bad" }[tone];
  return (
    <div className={cn("flex h-2.5 w-full gap-[3px]", className)}>
      {v > 0 && <div className={cn("h-full rounded-[4px]", color)} style={{ width: `${v * 100}%` }} />}
      {v < 1 && <div className="h-full flex-1 rounded-[4px] border border-line bg-surface-2" />}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-ink-3">{children}</div>;
}

export function Kv({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className="text-right font-medium text-ink tnum">{children}</span>
    </div>
  );
}
