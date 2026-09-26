"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronsUpDown, CircleDashed, Info, MoreHorizontal, Search, X, XCircle } from "lucide-react";
import { cn, Badge } from "./primitives";
import { usePrefs } from "@/components/prefs";
import { daysUntil, expiryState } from "@/lib/format";

/* ---------- Segmented pill filter ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  size = "md",
  className,
  dark,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  size?: "sm" | "md";
  className?: string;
  dark?: boolean;
}) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg p-0.5", dark ? "bg-side-2" : "bg-surface-3", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
              dark
                ? active
                  ? "bg-side-3 text-side-ink"
                  : "text-side-ink-3 hover:text-side-ink-2"
                : active
                  ? "border border-line bg-surface text-ink shadow-xs"
                  : "border border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            {it.label}
            {it.count !== undefined && <span className={cn("text-xs tnum", active ? "text-ink-3" : "text-ink-4")}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Underline tabs (Overview · Tool Usage · Spend …) ---------- */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: ReactNode; count?: number; href?: string }[];
  value: T;
  onChange?: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-line">
      {items.map((it) => {
        const active = it.value === value;
        const cls = cn(
          "focus-ring relative -mb-px inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 text-sm whitespace-nowrap transition-colors",
          active ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
        );
        const inner = (
          <>
            {it.label}
            {it.count !== undefined && <span className="text-xs text-ink-4 tnum">{it.count}</span>}
          </>
        );
        return it.href ? (
          <Link key={it.value} href={it.href} role="tab" aria-selected={active} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={it.value} type="button" role="tab" aria-selected={active} onClick={() => onChange?.(it.value)} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Modal (native <dialog>) ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn("m-auto w-[calc(100%-24px)] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop", wide ? "max-w-[720px]" : "max-w-[540px]")}
    >
      {open && (
        <div className="animate-pop">
          <div className="flex h-12 items-center justify-between border-b border-line px-5">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="focus-ring -mr-1.5 grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- Dropdown menu ---------- */
export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; hint?: string };
export function Menu({
  items,
  trigger,
  align = "right",
  triggerClassName,
  label,
}: {
  items: MenuItem[];
  trigger?: ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? "focus-ring grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"}
      >
        {trigger ?? <MoreHorizontal />}
      </button>
      {open && (
        <div role="menu" className={cn("animate-pop absolute z-40 mt-1.5 min-w-[196px] rounded-xl border border-line bg-surface p-1 shadow-pop", align === "right" ? "right-0" : "left-0")}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn(
                "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-surface-2",
                it.danger ? "text-bad-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {it.icon && <span className={it.danger ? "" : "text-ink-3"}>{it.icon}</span>}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-xs text-ink-4">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Popover (free content, opens up or down) ---------- */
export function Popover({
  trigger,
  children,
  placement = "bottom",
  align = "left",
  triggerClassName,
  label,
  panelClassName,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  placement?: "top" | "bottom" | "right";
  align?: "left" | "right";
  triggerClassName?: string;
  label?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          className={cn(
            "animate-pop absolute z-50 min-w-[232px] rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop",
            placement === "top" && "bottom-full mb-2",
            placement === "bottom" && "top-full mt-2",
            placement === "right" && "bottom-0 left-full ml-2",
            placement !== "right" && (align === "right" ? "right-0" : "left-0"),
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* ---------- Info tooltip ---------- */
export function InfoTip({ children, className }: { children: ReactNode; className?: string }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <span className={cn("relative inline-flex", className)} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button type="button" aria-describedby={id} onFocus={() => setShow(true)} onBlur={() => setShow(false)} className="focus-ring grid size-4 place-items-center rounded-full text-ink-4 hover:text-ink-2">
        <Info />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed font-normal text-ink-2 shadow-pop transition-opacity",
          show ? "opacity-100" : "opacity-0",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/* ---------- Expiry status chip ---------- */
export function ExpiryBadge({ date, compact }: { date: string | null | undefined; compact?: boolean }) {
  const { t, warnDays } = usePrefs();
  const state = expiryState(date, warnDays);
  const n = daysUntil(date);
  const rel = n === null ? "" : n === 0 ? t("e.today") : n > 0 ? t("e.daysLeft", { n }) : t("e.daysAgo", { n: -n });
  if (state === "missing")
    return (
      <Badge tone="neutral">
        <CircleDashed size={12} />
        {t("e.missing")}
      </Badge>
    );
  const tone = state === "expired" ? "bad" : state === "soon" ? "warn" : "good";
  const Icon = state === "expired" ? XCircle : state === "soon" ? AlertTriangle : CheckCircle2;
  return (
    <Badge tone={tone}>
      <Icon size={12} />
      {compact ? rel : `${t(state === "expired" ? "e.expired" : state === "soon" ? "e.soon" : "e.ok")} · ${rel}`}
    </Badge>
  );
}

/* ---------- Form controls ---------- */
const inputBase =
  "focus-ring h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink shadow-xs placeholder:text-ink-4 transition-colors hover:border-line-strong";

export function FieldShell({ label, error, children, span, htmlFor }: { label: ReactNode; error?: string; children: ReactNode; span?: 1 | 2; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", span === 2 && "sm:col-span-2")}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error && <span className="text-xs text-bad-ink">{error}</span>}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}
export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cn(inputBase, "h-auto py-2", props.className)} />;
}
export function Select(props: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputBase, "appearance-none pr-8", props.className)} />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-56">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputBase, "pl-8")} />
    </div>
  );
}
