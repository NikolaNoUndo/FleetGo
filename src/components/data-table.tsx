"use client";

import { useMemo, useState, type ReactNode } from "react";
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
};

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

  return (
    <div className={cn(!flush && "rounded-xl border border-line bg-surface shadow-xs")}>
      {hasToolbar && (
        <div className="flex flex-col gap-2.5 border-b border-line px-3 py-2.5 lg:flex-row lg:items-center">
          {filters && (
            <Segmented
              value={filter}
              onChange={setFilter}
              items={filters.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))}
            />
          )}
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
            {toolbar}
            {searchText && <SearchInput value={q} onChange={setQ} placeholder={t("c.search")} />}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
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
