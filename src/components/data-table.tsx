"use client";

import { Fragment, isValidElement, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { usePrefs } from "./prefs";
import { cn, Empty } from "./ui/primitives";
import { Menu, SearchInput, Segmented, type MenuItem } from "./ui/client";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
  hide?: "sm" | "md" | "lg";
  /**
   * Place on the phone card (below md the table becomes a list of cards):
   * title (first line), sub (second line, joined with ·), meta (like sub, with the header
   * as a label), end / end2 (right side, top and under it), hide. When no column says,
   * the first column is the title, the first right-aligned one the end, the rest sub.
   */
  m?: "title" | "sub" | "meta" | "end" | "end2" | "hide";
  /** What the phone card shows for this column, when it differs from the table cell. */
  mRender?: (row: T) => ReactNode;
};

/** A cell that only says "nothing here" ("—"): the phone card leaves it out. */
function isBlank(n: ReactNode): boolean {
  if (n === null || n === undefined || n === false || n === "" || n === "—") return true;
  return isValidElement(n) && (n.props as { children?: unknown }).children === "—";
}

type Slot = NonNullable<Column<never>["m"]>;
function mobileSlots<T>(columns: Column<T>[]): Record<Slot, Column<T>[]> {
  const out: Record<Slot, Column<T>[]> = { title: [], sub: [], meta: [], end: [], end2: [], hide: [] };
  const explicit = columns.some((c) => c.m);
  const endIdx = columns.findIndex((c, i) => i > 0 && c.align === "right");
  columns.forEach((c, i) => {
    const slot: Slot = explicit ? (c.m ?? "hide") : i === 0 ? "title" : i === endIdx ? "end" : c.hide === "lg" ? "hide" : "sub";
    out[slot].push(c);
  });
  return out;
}

export type Filter<T> = { value: string; label: ReactNode; predicate: (row: T) => boolean };

const hideCls = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  filters,
  toolbar,
  rowHref,
  actions,
  footer,
  initialSort,
  pageSize = 50,
  flush,
  mIcon,
  mGroup,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText?: (row: T) => string;
  filters?: Filter<T>[];
  toolbar?: ReactNode;
  rowHref?: (row: T) => string;
  actions?: (row: T) => MenuItem[];
  footer?: (visible: T[]) => ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  flush?: boolean;
  /** Phone list: the round-cornered icon tile in front of each row (see IconTile). */
  mIcon?: (row: T) => ReactNode;
  /** Phone list: a heading over each run of rows (e.g. the date), while the default sort holds. */
  mGroup?: (row: T) => string;
}) {
  const { t, locale } = usePrefs();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(filters?.[0]?.value ?? "all");
  const [sort, setSort] = useState(initialSort ?? null);
  const [limit, setLimit] = useState(pageSize);

  const counts = useMemo(() => Object.fromEntries((filters ?? []).map((f) => [f.value, rows.filter(f.predicate).length])), [filters, rows]);

  const visible = useMemo(() => {
    let out = rows;
    const f = filters?.find((x) => x.value === filter);
    if (f) out = out.filter(f.predicate);
    const needle = q.trim().toLowerCase();
    if (needle && searchText) out = out.filter((r) => searchText(r).toLowerCase().includes(needle));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const collator = new Intl.Collator(locale === "sr" ? "sr-Latn" : "en", { numeric: true });
        out = [...out].sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          if (va === vb) return 0;
          if (va === null || va === undefined || va === "") return 1;
          if (vb === null || vb === undefined || vb === "") return -1;
          const r = typeof va === "number" && typeof vb === "number" ? va - vb : collator.compare(String(va), String(vb));
          return sort.dir === "asc" ? r : -r;
        });
      }
    }
    return out;
  }, [rows, filters, filter, q, searchText, sort, columns, locale]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  const hasToolbar = filters || searchText || toolbar;
  const slots = useMemo(() => mobileSlots(columns), [columns]);

  const grouped = mGroup && initialSort && sort?.key === initialSort.key && sort.dir === initialSort.dir;
  const shown = visible.slice(0, limit);

  return (
    <div className={cn(!flush && "rounded-xl border border-line bg-surface shadow-xs")}>
      {hasToolbar && (
        <div className="flex flex-col gap-2.5 border-b border-line px-3 py-2.5 lg:flex-row lg:items-center">
          {filters && (
            <Segmented value={filter} onChange={setFilter} items={filters.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))} />
          )}
          {(searchText || toolbar) && (
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
              {searchText && (
                <div className="flex min-w-[60%] flex-1 sm:order-last sm:min-w-0 sm:flex-none">
                  <SearchInput value={q} onChange={setQ} placeholder={t("c.search")} />
                </div>
              )}
              {toolbar}
            </div>
          )}
        </div>
      )}

      {/* phones: the table as a list — tile, name and details on the left, amount / expiry on the right */}
      <ul className="md:hidden">
        {shown.map((row, i) => {
          const out = (c: Column<T>) => (c.mRender ?? c.render)(row);
          const cell = (c: Column<T>) => <Fragment key={c.key}>{out(c)}</Fragment>;
          const line2 = [...slots.sub.map((c) => ({ c, label: false })), ...slots.meta.map((c) => ({ c, label: true }))]
            .map((x) => ({ ...x, node: out(x.c) }))
            .filter((x) => !isBlank(x.node));
          const end = slots.end.filter((c) => !isBlank(out(c)));
          const end2 = slots.end2.filter((c) => !isBlank(out(c)));
          const group = grouped ? mGroup!(row) : null;
          const newGroup = group !== null && (i === 0 || mGroup!(shown[i - 1]) !== group);
          return (
            <Fragment key={row.id}>
              {/* the date runs look like the table's header row */}
              {newGroup && <li className="flex h-8 items-center border-b border-line bg-surface-2/60 px-4 text-xs font-medium text-ink-3">{group}</li>}
              <li
                onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                className={cn("flex items-center gap-3 py-3 pr-2 pl-4", i < shown.length - 1 && "border-b border-line/60", rowHref && "cursor-pointer active:bg-surface-2")}
              >
                {mIcon && <div className="shrink-0">{mIcon(row)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm font-medium text-ink [&_.max-w-\[300px\]]:max-w-none">{slots.title.map(cell)}</div>
                    {end.length > 0 && <div className="flex shrink-0 flex-col items-end gap-1 text-right text-sm tnum">{end.map(cell)}</div>}
                  </div>
                  {(line2.length > 0 || end2.length > 0) && (
                    <div className="mt-0.5 flex items-start justify-between gap-3">
                      <div className="min-w-0 text-xs text-ink-3 [&_.font-medium]:font-normal [&_.text-ink]:text-ink-2 [&_.text-sm]:text-xs">
                        {line2.map(({ c, label, node }, j) => (
                          <span key={c.key} className="mr-1.5 inline-flex max-w-full items-center gap-1 align-top">
                            {j > 0 && <span className="text-ink-4">·</span>}
                            {label && <span className="text-ink-4">{c.header}</span>}
                            <span className="min-w-0 truncate">{node}</span>
                          </span>
                        ))}
                      </div>
                      {end2.length > 0 && <div className="ml-auto flex shrink-0 flex-col items-end gap-1 text-right text-xs text-ink-3 tnum">{end2.map(cell)}</div>}
                    </div>
                  )}
                </div>
                {actions && (
                  <div className="shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                    <Menu items={actions(row)} triggerClassName="focus-ring grid size-9 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink" />
                  </div>
                )}
              </li>
            </Fragment>
          );
        })}
      </ul>
      {footer && visible.length > 0 && (
        <table className="w-full border-collapse text-sm md:hidden">
          <tbody>{footer(visible)}</tbody>
        </table>
      )}
      <div className="no-scrollbar hidden overflow-x-auto overflow-y-hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-9 px-3 text-xs font-medium whitespace-nowrap text-ink-3 first:pl-4 last:pr-4",
                    c.align === "right" ? "text-right" : "text-left",
                    c.hide && hideCls[c.hide],
                  )}
                  aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-ink", c.align === "right" && "flex-row-reverse")}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {actions && <th className="w-10 pr-2" aria-label={t("c.actions")} />}
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map((row) => (
              <tr
                key={row.id}
                onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                className={cn("group border-b border-line/60 last:border-0", rowHref ? "cursor-pointer hover:bg-surface-2" : "hover:bg-surface-2/50")}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "h-11 px-3 align-middle whitespace-nowrap first:pl-4 last:pr-4",
                      c.align === "right" ? "text-right tnum" : "text-left",
                      c.hide && hideCls[c.hide],
                      c.className,
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className="pr-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <Menu items={actions(row)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {footer && visible.length > 0 && <tfoot>{footer(visible)}</tfoot>}
        </table>
      </div>
      {visible.length === 0 && <Empty>{rows.length === 0 ? t("c.empty") : t("c.noResults")}</Empty>}
      {visible.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink-3">
          <span className="tnum">
            {locale === "sr" ? `Prikazano ${Math.min(limit, visible.length)} od ${visible.length}` : `Showing ${Math.min(limit, visible.length)} of ${visible.length}`}
          </span>
          {visible.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + pageSize)} className="font-medium text-accent-ink hover:underline">
              {locale === "sr" ? "Prikaži još" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// The app's own status colours (same as its badges); anything else stays neutral.
const TILE_TONES = {
  green: "border-good-line bg-good-soft text-good-ink",
  amber: "border-warn-line bg-warn-soft text-warn-ink",
  red: "border-bad-line bg-bad-soft text-bad-ink",
  accent: "border-accent-line bg-accent-soft text-accent-ink",
  gray: "border-line bg-surface-2 text-ink-3",
} as const;
export type TileTone = keyof typeof TILE_TONES;

/** Rounded square with an icon (or initials) in front of a phone list row. */
export function IconTile({ tone = "gray", children }: { tone?: TileTone; children: ReactNode }) {
  return <span className={cn("grid size-9 place-items-center rounded-lg border text-xs font-semibold [&_svg]:size-[17px] [&_svg]:stroke-[1.6]", TILE_TONES[tone])}>{children}</span>;
}
