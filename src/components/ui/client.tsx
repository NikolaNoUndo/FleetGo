"use client";

import Link from "@/components/ui/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
    <div role="tablist" className={cn("no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg p-0.5", dark ? "bg-side-2" : "bg-surface-3", className)}>
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
              size === "sm" ? "h-6 px-2 text-xs" : "h-9 rounded-lg px-3.5 text-sm sm:h-7 sm:rounded-md sm:px-2.5",
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
    // The bottom rule is an inset shadow and the active underline sits inside each tab,
    // so nothing pokes below the scroll box: no vertical scroll, underline never clipped.
    // below lg: a row of pills that scrolls sideways
    <div role="tablist" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto overflow-y-hidden px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:gap-6 lg:px-0 lg:shadow-[inset_0_-1px_0_var(--line)]">
      {items.map((it) => {
        const active = it.value === value;
        const cls = cn(
          "focus-ring relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap transition-colors",
          "h-10 rounded-full px-4 text-[14px] font-medium lg:h-9 lg:rounded-none lg:px-0 lg:text-sm",
          "lg:after:absolute lg:after:inset-x-0 lg:after:bottom-0 lg:after:h-0.5 lg:after:rounded-full lg:after:transition-colors",
          active
            ? "bg-ink text-white lg:bg-transparent lg:text-ink lg:after:bg-accent"
            : "bg-surface-2 text-ink-2 lg:bg-transparent lg:font-normal lg:text-ink-3 lg:after:bg-transparent lg:hover:text-ink-2",
        );
        const inner = (
          <>
            {it.label}
            {it.count !== undefined && <span className={cn("text-xs tnum", active ? "text-white/60 lg:text-ink-4" : "text-ink-4")}>{it.count}</span>}
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
/**
 * Centered dialog on larger screens; on phones a bottom sheet (full width, anchored to
 * the bottom edge, rounded top, clear of the home indicator), like native apps.
 */
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
        "rl-sheet border-line bg-surface p-0 text-ink shadow-pop",
        // phone: bottom sheet
        "mx-0 mt-auto mb-0 max-h-[94dvh] w-full max-w-none rounded-t-[28px] pb-[env(safe-area-inset-bottom)]",
        // tablet / desktop: centered card
        "sm:m-auto sm:max-h-[calc(100dvh-32px)] sm:w-[calc(100%-24px)] sm:rounded-xl sm:border sm:pb-0",
        wide ? "sm:max-w-[720px]" : "sm:max-w-[540px]",
      )}
    >
      {open && (
        <div className="sheet-in sm:animate-pop">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex h-14 items-center justify-between gap-3 px-5 sm:h-12 sm:border-b sm:border-line">
            <h2 className="min-w-0 truncate text-[19px] font-bold tracking-[-0.02em] sm:text-sm sm:font-semibold sm:tracking-normal">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring -mr-1 grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink sm:-mr-1.5 sm:size-7 sm:rounded-md sm:bg-transparent sm:text-ink-3 sm:hover:bg-surface-2"
              aria-label="Close"
            >
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
  const [pos, setPos] = useState<{ style: React.CSSProperties; layer: Element; sheet: boolean } | null>(null);
  const open = pos !== null;
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * The list is rendered in <body> with fixed coordinates, so tables with
   * scrolling or clipped containers can never hide it. Opens upward when
   * there is not enough room below.
   */
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return null;
    // phones: an action sheet from the bottom edge instead of a small dropdown
    if (window.innerWidth < 640) return { style: {}, layer: layerFor(btnRef.current), sheet: true };
    const h = items.length * 32 + 12;
    const below = window.innerHeight - r.bottom;
    const up = below < h + 12 && r.top > below;
    const s: React.CSSProperties = { position: "fixed", minWidth: 196 };
    if (up) s.bottom = window.innerHeight - r.top + 6;
    else s.top = r.bottom + 6;
    if (align === "right") s.right = Math.max(8, window.innerWidth - r.right);
    else s.left = Math.max(8, r.left);
    return { style: s, layer: layerFor(btnRef.current), sheet: false };
  };

  const sheet = pos?.sheet ?? false;
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    // the action sheet has its own backdrop; the browser bar showing or hiding must not close it
    if (sheet) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) close();
    };
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, sheet]);

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setPos((p) => (p ? null : place()))}
        className={triggerClassName ?? "focus-ring grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"}
      >
        {trigger ?? <MoreHorizontal />}
      </button>
      {open &&
        createPortal(
          pos.sheet ? (
            <div ref={menuRef} className="fixed inset-0 z-[300]" onClick={(e) => e.stopPropagation()}>
              <div className="fade-in absolute inset-0 bg-[rgba(14,16,19,0.36)]" onClick={() => setPos(null)} />
              <div role="menu" aria-label={label} className="sheet-in absolute inset-x-0 bottom-0 rounded-t-[28px] bg-surface px-3 pt-2.5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-pop">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
                {label && <div className="px-2 pt-1 pb-2 text-[19px] font-bold tracking-[-0.02em] text-ink">{label}</div>}
                {items.map((it) => (
                  <button
                    key={it.label}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setPos(null);
                      it.onSelect();
                    }}
                    className={cn("flex h-14 w-full items-center gap-3.5 rounded-2xl px-2 text-left text-[15px] active:bg-surface-2", it.danger ? "text-bad-ink" : "text-ink")}
                  >
                    {it.icon && (
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-[19px]", it.danger ? "bg-bad-soft" : "bg-surface-2 text-ink-2")}>{it.icon}</span>
                    )}
                    <span className="flex-1">{it.label}</span>
                    {it.hint && <span className="text-xs text-ink-4">{it.hint}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div ref={menuRef} role="menu" style={pos.style} className="animate-pop z-[300] rounded-xl border border-line bg-surface p-1 shadow-pop" onClick={(e) => e.stopPropagation()}>
              {items.map((it) => (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setPos(null);
                    it.onSelect();
                  }}
                  className={cn(
                    "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm whitespace-nowrap hover:bg-surface-2",
                    it.danger ? "text-bad-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {it.icon && <span className={it.danger ? "" : "text-ink-3"}>{it.icon}</span>}
                  <span className="flex-1">{it.label}</span>
                  {it.hint && <span className="text-xs text-ink-4">{it.hint}</span>}
                </button>
              ))}
            </div>
          ),
          pos.layer,
        )}
    </div>
  );
}

/**
 * Where floating lists are rendered: <body>, or the open <dialog> when inside one
 * (a modal dialog sits in the browser's top layer, above anything in <body>).
 */
export function layerFor(el: Element | null): Element {
  return el?.closest("dialog") ?? document.body;
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
  panelStyle,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  placement?: "top" | "bottom" | "right";
  align?: "left" | "right";
  triggerClassName?: string;
  label?: string;
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
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
          style={panelStyle}
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
      {/* rendered only while shown: a hidden one would still widen the page on phones */}
      {show && (
        <span
          id={id}
          role="tooltip"
          className="animate-pop pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-60 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed font-normal text-ink-2 shadow-pop"
        >
          {children}
        </span>
      )}
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
// Phones: tall filled fields with 16px text (iOS zooms into anything smaller on focus).
const inputBase = cn(
  "focus-ring w-full border text-ink placeholder:text-ink-4 transition-colors",
  "h-[50px] rounded-2xl border-transparent bg-surface-2 px-4 text-[16px] focus:border-accent-line focus:bg-surface",
  "sm:h-8 sm:rounded-lg sm:border-line sm:bg-surface sm:px-2.5 sm:text-sm sm:shadow-xs sm:hover:border-line-strong",
);

export function FieldShell({ label, error, children, span, htmlFor }: { label: ReactNode; error?: string; children: ReactNode; span?: 1 | 2; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", span === 2 && "sm:col-span-2")}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2 sm:text-xs">
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
  return <textarea rows={3} {...props} className={cn(inputBase, "h-auto py-3 sm:h-auto sm:py-2", props.className)} />;
}
export function Select(props: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputBase, "appearance-none pr-10 sm:pr-8", props.className)} />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-3 sm:right-2.5" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
      <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3 max-sm:size-[18px] sm:left-2.5" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputBase, "h-12 rounded-full pl-11 sm:pl-8")} />
    </div>
  );
}
