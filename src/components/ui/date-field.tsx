"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { usePrefs } from "../prefs";
import { cn } from "./primitives";
import { layerFor } from "./client";

/**
 * Date entry in day.month.year order (browsers show the native picker in the OS
 * locale, e.g. mm/dd/yyyy). Type "29.09.2026", "29092026" or "29.9.26", or pick
 * from the calendar. The value in and out is ISO "yyyy-mm-dd" ("" when empty).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const validYmd = (y: number, m: number, d: number) => {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function toDisplay(iso: string): string {
  return ISO.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.` : iso;
}

/** "29.09.2026", "29/9/2026", "29092026"; two-digit years only when `loose` (on leaving the field). */
export function parseDisplay(text: string, loose = false): string | null {
  const s = text.trim().replace(/\.$/, "");
  if (!s) return null;
  let d: number, m: number, y: number;
  const digits = s.replace(/\s/g, "");
  if (/^\d{8}$/.test(digits)) [d, m, y] = [+digits.slice(0, 2), +digits.slice(2, 4), +digits.slice(4)];
  else if (loose && /^\d{6}$/.test(digits)) [d, m, y] = [+digits.slice(0, 2), +digits.slice(2, 4), 2000 + +digits.slice(4)];
  else {
    const parts = s.split(/[.\/\-,\s]+/).filter(Boolean);
    if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
    if (parts[2].length === 2 && loose) parts[2] = String(2000 + +parts[2]);
    if (parts[2].length !== 4) return null;
    [d, m, y] = parts.map(Number);
  }
  return validYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function addMonthsIso(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
}

const MONTHS = {
  sr: ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const DAYS = { sr: ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"], en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] };

/* ---------- shared floating panel (portaled so forms and dialogs can't clip it) ---------- */

function useFloating(anchor: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLElement | null>, open: boolean, close: () => void, height: number) {
  const [pos, setPos] = useState<{ style: React.CSSProperties; layer: Element } | null>(null);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const up = below < height + 12 && r.top > below;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 312));
      setPos({
        style: up ? { position: "fixed", left, bottom: window.innerHeight - r.top + 6 } : { position: "fixed", left, top: r.bottom + 6 },
        layer: layerFor(anchor.current),
      });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = (e: Event) => !panel.current?.contains(e.target as Node) && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return open ? pos : null;
}

const panelCls = "animate-pop z-[300] w-[304px] rounded-xl border border-line bg-surface p-3 text-ink shadow-pop";
const navBtn = "grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink";
const chip = "h-7 rounded-md border border-line px-2 text-xs font-medium text-ink-2 hover:border-line-strong hover:bg-surface-2 hover:text-ink";

/* ---------- DateField ---------- */

export type DatePreset = { label: string; value: string };

export function DateField({
  id,
  value,
  onChange,
  required,
  presets,
  className,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** quick picks under the calendar, e.g. "+1 godina" */
  presets?: DatePreset[];
  className?: string;
  invalid?: boolean;
}) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [text, setText] = useState(() => toDisplay(value));
  // the value we last saw or sent; a different incoming value (calendar, suggestion) redraws the text
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(toDisplay(value));
  }
  const emit = (v: string) => {
    setSeen(v);
    onChange(v);
  };

  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pos = useFloating(wrap, panel, open, () => setOpen(false), 380);

  const base = ISO.test(value) ? value : todayIso();
  const [view, setView] = useState({ y: +base.slice(0, 4), m: +base.slice(5, 7) });
  const [menu, setMenu] = useState<"m" | "y" | null>(null);
  const openCalendar = () => {
    const b = ISO.test(value) ? value : todayIso();
    setView({ y: +b.slice(0, 4), m: +b.slice(5, 7) });
    setMenu(null);
    setOpen((o) => !o);
  };
  const pick = (iso: string) => {
    setText(toDisplay(iso));
    emit(iso);
    setOpen(false);
  };

  const today = todayIso();
  const first = new Date(Date.UTC(view.y, view.m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(view.y, view.m - 1, 1 - offset + i));
    const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return { iso, day: d.getUTCDate(), inMonth: d.getUTCMonth() === view.m - 1 };
  });
  const move = (n: number) => {
    const t = new Date(Date.UTC(view.y, view.m - 1 + n, 1));
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 });
  };
  const nowY = new Date().getFullYear();
  const years = Array.from({ length: 51 }, (_, i) => nowY - 20 + i);
  if (!years.includes(view.y)) years.push(view.y);
  years.sort((a, b) => a - b);

  const bad = invalid || (!!text.trim() && !parseDisplay(text, true));

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <input
        id={id}
        value={text}
        inputMode="numeric"
        autoComplete="off"
        placeholder={sr ? "dd.mm.gggg." : "dd.mm.yyyy"}
        aria-invalid={bad || undefined}
        onChange={(e) => {
          let v = e.target.value;
          // "29" → "29.", "29.09" → "29.09." while typing forward
          if (v.length > text.length && (/^\d{2}$/.test(v) || /^\d{1,2}\.\d{2}$/.test(v))) v += ".";
          setText(v);
          if (!v.trim()) return emit("");
          const iso = parseDisplay(v);
          emit(iso ?? v);
        }}
        onBlur={() => {
          const iso = parseDisplay(text, true);
          if (iso) {
            setText(toDisplay(iso));
            if (iso !== value) emit(iso);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && e.altKey) {
            e.preventDefault();
            openCalendar();
          }
        }}
        className={cn(
          "focus-ring h-[50px] w-full rounded-2xl border bg-surface-2 pr-11 pl-4 text-sm focus:bg-surface sm:h-8 sm:rounded-lg sm:bg-surface sm:pr-9 sm:pl-2.5 text-ink tnum transition-colors placeholder:text-ink-4 sm:shadow-xs sm:hover:border-line-strong",
          bad ? "border-bad-line" : "border-transparent focus:border-accent-line sm:border-line",
        )}
      />
      <button
        type="button"
        onClick={openCalendar}
        aria-label={sr ? "Otvori kalendar" : "Open calendar"}
        aria-expanded={open}
        className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 sm:right-1 sm:size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <CalendarDays size={15} />
      </button>

      {pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={sr ? "Kalendar" : "Calendar"}
            style={pos.style}
            className={panelCls}
            onMouseDown={(e) => {
              // a click anywhere else in the calendar closes the month / year list
              if (menu && !(e.target as HTMLElement).closest("[role=listbox], [aria-haspopup=listbox]")) setMenu(null);
            }}
          >
            <div className="mb-2 flex items-center gap-1">
              <button type="button" className={navBtn} onClick={() => move(-1)} aria-label={sr ? "Prethodni mesec" : "Previous month"}>
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={menu === "m"}
                onClick={() => setMenu(menu === "m" ? null : "m")}
                className={cn("inline-flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-lg pr-1.5 pl-2 text-sm font-semibold capitalize hover:bg-surface-2", menu === "m" && "bg-surface-2")}
              >
                <span className="truncate">{MONTHS[locale][view.m - 1]}</span>
                <ChevronDown size={13} className={cn("shrink-0 text-ink-3 transition-transform", menu === "m" && "rotate-180")} />
              </button>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={menu === "y"}
                onClick={() => setMenu(menu === "y" ? null : "y")}
                className={cn("inline-flex h-8 items-center gap-1 rounded-lg pr-1.5 pl-2 text-sm font-semibold tnum hover:bg-surface-2", menu === "y" && "bg-surface-2")}
              >
                {view.y}
                <ChevronDown size={13} className={cn("shrink-0 text-ink-3 transition-transform", menu === "y" && "rotate-180")} />
              </button>
              <button type="button" className={navBtn} onClick={() => move(1)} aria-label={sr ? "Sledeći mesec" : "Next month"}>
                <ChevronRight size={16} />
              </button>
            </div>

            {menu && (
              <ul
                role="listbox"
                // opens right under the header; 7 rows visible, the rest by scrolling, chosen one on top
                ref={(el) => {
                  const sel = el?.querySelector<HTMLElement>("[aria-selected=true]");
                  if (el && sel) el.scrollTop = sel.offsetTop - 4;
                }}
                className="absolute top-[52px] right-3 left-3 z-10 max-h-[218px] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop"
              >
                {(menu === "y" ? years.map((y) => ({ v: y, label: String(y) })) : MONTHS[locale].map((n, i) => ({ v: i + 1, label: n }))).map((o) => {
                  const sel = menu === "y" ? o.v === view.y : o.v === view.m;
                  return (
                    <li key={o.v}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={sel}
                        onClick={() => {
                          setView(menu === "y" ? { ...view, y: o.v } : { ...view, m: o.v });
                          setMenu(null);
                        }}
                        className={cn(
                          "flex h-[30px] w-full items-center rounded-md px-2.5 text-left text-sm capitalize tnum",
                          sel ? "bg-accent font-semibold text-white" : o.v === (menu === "y" ? nowY : 0) ? "font-semibold text-accent-ink hover:bg-surface-2" : "hover:bg-surface-2",
                        )}
                      >
                        {o.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DAYS[locale].map((d, i) => (
                <div key={d} className={cn("pb-1 text-[11px] font-medium", i >= 5 ? "text-ink-4" : "text-ink-3")}>
                  {d}
                </div>
              ))}
              {cells.map((c) => {
                const sel = c.iso === value;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => pick(c.iso)}
                    className={cn(
                      "h-9 rounded-lg text-sm tnum transition-colors",
                      sel ? "bg-accent font-semibold text-white" : c.iso === today ? "font-semibold text-accent-ink ring-1 ring-accent-line ring-inset hover:bg-accent-soft" : "hover:bg-surface-2",
                      !sel && !c.inMonth && "text-ink-4",
                    )}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
              <button type="button" className={chip} onClick={() => pick(today)}>
                {sr ? "Danas" : "Today"}
              </button>
              {presets?.map((p) => (
                <button key={p.label} type="button" className={chip} onClick={() => pick(p.value)}>
                  {p.label}
                </button>
              ))}
              {!required && value && (
                <button
                  type="button"
                  className="ml-auto h-7 px-1.5 text-xs font-medium text-ink-3 hover:text-bad-ink"
                  onClick={() => {
                    setText("");
                    emit("");
                    setOpen(false);
                  }}
                >
                  {sr ? "Obriši" : "Clear"}
                </button>
              )}
            </div>
          </div>,
          pos.layer,
        )}
    </div>
  );
}

/** Quick picks "+6 meseci / +1 / +5 godina" counted from `from` (or today). */
export function expiryPresets(from: string | null | undefined, locale: "sr" | "en"): DatePreset[] {
  const base = from && ISO.test(from) ? from : todayIso();
  const sr = locale === "sr";
  return [
    { label: sr ? "+6 mes." : "+6 mo.", value: addMonthsIso(base, 6) },
    { label: sr ? "+1 god." : "+1 yr", value: addMonthsIso(base, 12) },
    { label: sr ? "+5 god." : "+5 yrs", value: addMonthsIso(base, 60) },
  ];
}

/* ---------- MonthField ("11.2026"), value "yyyy-mm" ---------- */

export function MonthField({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const valid = /^\d{4}-\d{2}$/.test(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pos = useFloating(wrap, panel, open, () => setOpen(false), 200);
  const nowY = new Date().getFullYear();
  const [year, setYear] = useState(valid ? +value.slice(0, 4) : nowY);
  const label = valid ? `${MONTHS[locale][+value.slice(5, 7) - 1]} ${value.slice(0, 4)}.` : "";

  return (
    <>
      <button
        ref={wrap}
        id={id}
        type="button"
        onClick={() => {
          setYear(valid ? +value.slice(0, 4) : nowY);
          setOpen((o) => !o);
        }}
        className="focus-ring flex h-[50px] w-full items-center justify-between rounded-2xl border border-transparent bg-surface-2 pr-4 pl-4 sm:h-8 sm:rounded-lg sm:border-line sm:bg-surface sm:pr-2 sm:pl-2.5 text-left text-sm text-ink shadow-xs transition-colors hover:border-line-strong"
      >
        <span className={cn("capitalize", !label && "text-ink-4 normal-case")}>{label || (sr ? "Izaberi mesec" : "Pick a month")}</span>
        <CalendarDays size={15} className="text-ink-3" />
      </button>
      {pos &&
        createPortal(
          <div ref={panel} role="dialog" style={pos.style} className={panelCls}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className={navBtn} onClick={() => setYear(year - 1)} aria-label={sr ? "Prethodna godina" : "Previous year"}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold tnum">{year}</span>
              <button type="button" className={navBtn} onClick={() => setYear(year + 1)} aria-label={sr ? "Sledeća godina" : "Next year"}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTHS[locale].map((n, i) => {
                const v = `${year}-${pad(i + 1)}`;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      onChange(v);
                      setOpen(false);
                    }}
                    className={cn("h-9 rounded-lg text-sm capitalize transition-colors", v === value ? "bg-accent font-semibold text-white" : "hover:bg-surface-2")}
                  >
                    {n.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            {value && (
              <div className="mt-2 flex justify-end border-t border-line pt-2">
                <button
                  type="button"
                  className="h-7 px-1.5 text-xs font-medium text-ink-3 hover:text-bad-ink"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {sr ? "Obriši" : "Clear"}
                </button>
              </div>
            )}
          </div>,
          pos.layer,
        )}
    </>
  );
}
