"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Info, MoreHorizontal, X, XCircle } from "lucide-react";
import { cn, Badge } from "./primitives";
import { usePrefs } from "@/components/prefs";
import { daysUntil, expiryState } from "@/lib/format";

/* ---------- Segmented control (the "All Alerts / News / …" pill) ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[12px] bg-surface-3/70 p-1", className)}>
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
              "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-[9px] font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13.5px]",
              active ? "raised text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {it.label}
            {it.count !== undefined && <span className={cn("tnum text-[11.5px]", active ? "text-ink-3" : "text-ink-4")}>{it.count}</span>}
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
      className={cn(
        "m-auto w-[calc(100%-24px)] rounded-[18px] border border-line bg-surface p-0 text-ink shadow-pop",
        wide ? "max-w-[720px]" : "max-w-[560px]",
      )}
    >
      {open && (
        <div className="animate-pop">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            <button type="button" onClick={onClose} className="focus-ring -mr-1.5 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- Dropdown menu (the "Status / Plan / Last scan" list) ---------- */
export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean };
export function Menu({ items, trigger, align = "right" }: { items: MenuItem[]; trigger?: ReactNode; align?: "left" | "right" }) {
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
        onClick={() => setOpen((o) => !o)}
        className="focus-ring grid size-8 place-items-center rounded-[9px] text-ink-3 hover:bg-surface-3 hover:text-ink"
      >
        {trigger ?? <MoreHorizontal size={18} />}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "animate-pop absolute z-30 mt-1.5 min-w-[184px] rounded-[14px] border border-line bg-surface p-1.5 shadow-pop",
            align === "right" ? "right-0" : "left-0",
          )}
        >
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
                "flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13.5px] font-medium hover:bg-surface-2",
                it.danger ? "text-bad" : "text-ink-2 hover:text-ink",
              )}
            >
              {it.icon && <span className="[&>svg]:size-4">{it.icon}</span>}
              {it.label}
            </button>
          ))}
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
      <button type="button" aria-describedby={id} onFocus={() => setShow(true)} onBlur={() => setShow(false)} className="focus-ring grid size-5 place-items-center rounded-full text-ink-4 hover:text-ink-2">
        <Info size={15} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-64 -translate-x-1/2 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed font-normal text-ink-2 shadow-pop transition-opacity",
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
        <CircleDashed size={13} />
        {t("e.missing")}
      </Badge>
    );
  const tone = state === "expired" ? "bad" : state === "soon" ? "warn" : "good";
  const Icon = state === "expired" ? XCircle : state === "soon" ? AlertTriangle : CheckCircle2;
  return (
    <Badge tone={tone}>
      <Icon size={13} />
      {compact ? rel : `${t(state === "expired" ? "e.expired" : state === "soon" ? "e.soon" : "e.ok")} · ${rel}`}
    </Badge>
  );
}

/* ---------- Form controls ---------- */
const inputBase =
  "focus-ring h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink shadow-xs placeholder:text-ink-4 transition-colors hover:border-line-strong";

export function FieldShell({ label, error, children, span, htmlFor }: { label: ReactNode; error?: string; children: ReactNode; span?: 1 | 2; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", span === 2 && "sm:col-span-2")}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}
export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cn(inputBase, "h-auto py-2.5", props.className)} />;
}
export function Select(props: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          inputBase,
          "appearance-none pr-9 invalid:text-ink-4",
          props.className,
        )}
      />
      <svg className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <svg className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputBase, "h-9 pl-9")} />
    </div>
  );
}
