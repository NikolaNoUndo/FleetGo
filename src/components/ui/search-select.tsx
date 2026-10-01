"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "./primitives";
import { layerFor } from "./client";

export type SearchOption = { value: string; label: string; sub?: string };

/** Lower-case, no accents (č→c, š→s, ž→z, ć→c, đ→d), so "zeleni" finds "Zeleni karton" and "cemt" finds "CEMT". */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * A select whose field turns into a search box: click it, type, and the list below
 * keeps only what matches (by name or the grey detail). Arrows + Enter pick, Esc closes.
 * `create` adds a last row for a new value made of what was typed (e.g. another kind
 * of document), which is then just a value like any other.
 */
export function SearchSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  emptyLabel,
  create,
  invalid,
}: {
  id?: string;
  value: string;
  options: SearchOption[];
  onChange: (v: string) => void;
  /** shown when nothing is picked */
  placeholder: string;
  /** an extra first row that clears the field (optional fields) */
  emptyLabel?: string;
  create?: { label: (typed: string) => string };
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ style: React.CSSProperties; layer: Element } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const shownLabel = selected?.label ?? (value && create ? value : "");

  const needle = fold(q.trim());
  const matches = useMemo(
    () => (needle ? options.filter((o) => fold(o.label).includes(needle) || (o.sub && fold(o.sub).includes(needle))) : options),
    [options, needle],
  );
  const canCreate = !!create && q.trim().length > 1 && !options.some((o) => fold(o.label) === needle);
  type Row = { kind: "empty" } | { kind: "opt"; o: SearchOption } | { kind: "new" };
  const rows: Row[] = [...(emptyLabel && !needle ? [{ kind: "empty" } as Row] : []), ...matches.map((o) => ({ kind: "opt", o }) as Row), ...(canCreate ? [{ kind: "new" } as Row] : [])];

  // The list lives in <body> (or the open dialog) with fixed coordinates, so the
  // scrolling form can't clip it; it opens upward when there is more room above.
  const place = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (!r) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const below = vh - r.bottom;
    const up = below < 260 && r.top > below;
    const maxH = Math.max(160, Math.min(288, (up ? r.top : below) - 12));
    setPos({
      style: up
        ? { position: "fixed", left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxHeight: maxH }
        : { position: "fixed", left: r.left, width: r.width, top: r.bottom + 4, maxHeight: maxH },
      layer: layerFor(inputRef.current),
    });
  };
  const show = () => {
    if (open) return;
    setQ("");
    const i = rows.findIndex((x) => x.kind === "opt" && x.o.value === value);
    setActive(Math.max(0, i));
    setOpen(true);
    place();
  };
  const hide = () => {
    setOpen(false);
    setQ("");
    setPos(null);
  };
  const pick = (row: Row) => {
    if (row.kind === "empty") onChange("");
    else if (row.kind === "opt") onChange(row.o.value);
    else onChange(q.trim());
    hide();
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) place();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open]);

  // keep the highlighted row in view while moving with the arrow keys
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) show();
      else setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      if (open && rows[active]) {
        e.preventDefault();
        pick(rows[active]);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // don't close the dialog around it
      hide();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? q : shownLabel}
        placeholder={open ? shownLabel || placeholder : placeholder}
        onFocus={show}
        onClick={show}
        onBlur={() => setTimeout(hide, 120)}
        onKeyDown={onKey}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(emptyLabel && !e.target.value.trim() ? 1 : 0);
          if (!open) show();
        }}
        className={cn(
          "focus-ring h-[42px] w-full cursor-pointer rounded-lg border bg-surface pr-9 pl-3 text-[16px] text-ink shadow-xs transition-colors placeholder:text-ink-4 hover:border-line-strong focus:cursor-text sm:h-8 sm:pr-8 sm:pl-2.5 sm:text-sm",
          invalid ? "border-bad-line" : "border-line",
          open && "placeholder:text-ink-3",
        )}
      />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3 sm:right-2.5" />
      {open &&
        pos &&
        createPortal(
          <ul ref={listRef} role="listbox" style={pos.style} className="animate-pop z-[300] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop">
            {rows.length === 0 && <li className="px-2.5 py-2 text-sm text-ink-3">—</li>}
            {rows.map((row, i) => {
              const on = i === active;
              const isSel = row.kind === "opt" ? row.o.value === value : row.kind === "empty" ? !value : false;
              return (
                <li key={row.kind === "opt" ? row.o.value : row.kind} data-i={i} role="option" aria-selected={isSel}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(row)}
                    className={cn(
                      "flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[15px] sm:min-h-8 sm:text-sm",
                      on && "bg-surface-2",
                      row.kind === "new" ? "font-medium text-accent-ink" : row.kind === "empty" ? "text-ink-3" : "text-ink",
                    )}
                  >
                    {row.kind === "new" && <Plus size={14} className="shrink-0" />}
                    <span className="min-w-0 flex-1">
                      {row.kind === "opt" ? (
                        <>
                          {row.o.label}
                          {row.o.sub && <span className="ml-1.5 text-xs text-ink-3">{row.o.sub}</span>}
                        </>
                      ) : row.kind === "empty" ? (
                        emptyLabel
                      ) : (
                        create!.label(q.trim())
                      )}
                    </span>
                    {isSel && <Check size={14} className="shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>,
          pos.layer,
        )}
    </div>
  );
}
