"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { saveRecord, deleteRecord } from "@/app/actions";
import {
  RESOURCES,
  type FieldDef,
  type Refs,
  type ResourceKey,
} from "@/lib/resources";
import { RESOURCE_MODULE } from "@/lib/auth/permissions";
import {
  DOC_TYPES,
  DOC_VALIDITY_DAYS,
  OPTION_SETS,
  addDaysISO,
  type EntityType,
} from "@/lib/catalog";
import { todayISO } from "@/lib/format";
import { usePrefs } from "./prefs";
import { Button, cn } from "./ui/primitives";
import {
  FieldShell,
  Modal,
  Segmented,
  Select,
  TextArea,
  TextInput,
  layerFor,
  type MenuItem,
} from "./ui/client";
import { DateField, MonthField, expiryPresets } from "./ui/date-field";
import type { TKey } from "@/lib/i18n";

type Values = Record<string, string | boolean>;
type Row = Record<string, unknown> & { id: string };

function initialValues(
  fields: FieldDef[],
  record: Row | null,
  fixed?: Record<string, string>,
): Values {
  const v: Values = {};
  for (const f of fields) {
    const raw = record?.[f.name];
    if (f.type === "bool")
      v[f.name] = record ? Boolean(raw) : Boolean(f.defaultValue ?? false);
    else if (f.type === "money") {
      v[f.name] = raw === null || raw === undefined ? "" : String(raw);
      v.currency = String(record?.currency ?? f.defaultValue ?? "RSD");
    } else if (f.type === "links") {
      v[f.name] = Array.isArray(raw)
        ? (raw as string[]).join(",")
        : raw
          ? String(raw)
          : "";
    } else if (f.type === "drivers") {
      v[f.name] = raw ? String(raw) : "";
      v.extraDriverIds = Array.isArray(record?.extraDriverIds)
        ? (record.extraDriverIds as string[]).join(",")
        : "";
    } else if (f.type === "month") {
      v[f.name] = raw ? String(raw).slice(0, 7) : "";
    } else if (raw !== null && raw !== undefined) v[f.name] = String(raw);
    else if (!record && f.type === "date" && f.required) v[f.name] = todayISO();
    else v[f.name] = f.defaultValue !== undefined ? String(f.defaultValue) : "";
  }
  if (fixed) Object.assign(v, fixed);
  return v;
}

/**
 * Pick an existing supplier or type a new name. The value is either the supplier id
 * or "new:<name>"; new names are saved to the supplier list on submit.
 */
export function SupplierPicker({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const { locale } = usePrefs();
  const current = value.startsWith("new:")
    ? value.slice(4)
    : (options.find((o) => o.id === value)?.label ?? "");
  const [text, setText] = useState(current);
  const [pos, setPos] = useState<{
    style: React.CSSProperties;
    layer: Element;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const q = text.trim().toLowerCase();
  const matches = options
    .filter((o) => !q || o.label.toLowerCase().includes(q))
    .slice(0, 8);
  const exact = options.find((o) => o.label.toLowerCase() === q);

  // The list lives in <body> with fixed coordinates so the scrolling form can't clip it.
  const openList = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (!r) return;
    const up =
      window.innerHeight - r.bottom < 240 &&
      r.top > window.innerHeight - r.bottom;
    setPos({
      style: up
        ? {
            position: "fixed",
            left: r.left,
            width: r.width,
            bottom: window.innerHeight - r.top + 4,
          }
        : {
            position: "fixed",
            left: r.left,
            width: r.width,
            top: r.bottom + 4,
          },
      layer: layerFor(inputRef.current),
    });
  };
  const close = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) setPos(null);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const pick = (v: string, label: string) => {
    onChange(v);
    setText(label);
    close();
  };
  return (
    <div className="relative">
      <TextInput
        ref={inputRef}
        id={id}
        value={text}
        autoComplete="off"
        placeholder={
          locale === "sr"
            ? "Izaberi ili upiši novog…"
            : "Pick or type a new one…"
        }
        onFocus={openList}
        onBlur={() => setTimeout(close, 120)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (!pos) openList();
          const hit = options.find(
            (o) => o.label.toLowerCase() === v.trim().toLowerCase(),
          );
          onChange(!v.trim() ? "" : hit ? hit.id : `new:${v.trim()}`);
        }}
      />
      {pos &&
        (matches.length > 0 || (q && !exact)) &&
        createPortal(
          <ul
            ref={listRef}
            style={pos.style}
            className="animate-pop z-[300] max-h-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop"
          >
            {matches.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.id, o.label)}
                  className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-surface-2"
                >
                  {o.label}
                </button>
              </li>
            ))}
            {q && !exact && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(`new:${text.trim()}`, text.trim())}
                  className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium text-accent-ink hover:bg-accent-soft"
                >
                  <Plus size={13} /> {locale === "sr" ? "Dodaj" : "Add"} „
                  {text.trim()}“
                </button>
              </li>
            )}
          </ul>,
          pos.layer,
        )}
    </div>
  );
}

/** Any number of linked records (e.g. the trailers a truck uses), shown as removable chips. */
function LinksField({
  id,
  label,
  error,
  value,
  options,
  onChange,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  value: string;
  options: { id: string; label: string; sub?: string }[];
  onChange: (v: string) => void;
}) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const ids = value ? value.split(",").filter(Boolean) : [];
  const byId = new Map(options.map((o) => [o.id, o]));
  const rest = options.filter((o) => !ids.includes(o.id));
  return (
    <FieldShell label={label} error={error} span={2} htmlFor={id}>
      <div className="flex flex-wrap items-center gap-2">
        {ids.map((x) => (
          <span
            key={x}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface-2 pr-1 pl-2.5 text-sm"
          >
            {byId.get(x)?.label ?? "—"}
            <button
              type="button"
              aria-label={sr ? "Ukloni" : "Remove"}
              onClick={() => onChange(ids.filter((y) => y !== x).join(","))}
              className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
            >
              <X />
            </button>
          </span>
        ))}
        {rest.length > 0 && (
          <div className="min-w-[180px] flex-1">
            <Select
              id={id}
              value=""
              onChange={(e) =>
                e.target.value && onChange([...ids, e.target.value].join(","))
              }
            >
              <option value="">
                {ids.length
                  ? sr
                    ? "+ Dodaj još…"
                    : "+ Add another…"
                  : sr
                    ? "Nema – izaberi da dodaš"
                    : "None – pick to add"}
              </option>
              {rest.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                  {o.sub ? ` · ${o.sub}` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </FieldShell>
  );
}

/** Main driver plus optional second, third… driver; each extra row appears once the previous one is filled. */
function DriversField({
  id,
  label,
  error,
  main,
  extras,
  options,
  onChange,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  main: string;
  extras: string;
  options: { id: string; label: string; sub?: string }[];
  onChange: (main: string, extras: string) => void;
}) {
  const { t, locale } = usePrefs();
  const sr = locale === "sr";
  const filled = extras ? extras.split(",").filter(Boolean) : [];
  // empty rows the user added but hasn't picked a driver for yet
  const [blank, setBlank] = useState(0);
  const list = [...filled, ...Array<string>(blank).fill("")];
  const ORD = sr
    ? ["Drugi", "Treći", "Četvrti", "Peti", "Šesti"]
    : ["Second", "Third", "Fourth", "Fifth", "Sixth"];
  const ADD = sr
    ? [
        "Dodaj drugog vozača",
        "Dodaj trećeg vozača",
        "Dodaj četvrtog vozača",
        "Dodaj petog vozača",
        "Dodaj šestog vozača",
      ]
    : ORD.map((o) => `Add ${o.toLowerCase()} driver`);
  const chosen = (except: string) =>
    new Set([main, ...filled].filter((x) => x && x !== except));
  const emit = (m: string, l: string[]) => {
    const clean = l.filter(Boolean);
    setBlank(l.length - clean.length);
    // no extras without a main driver: promote the first extra
    if (!m && clean.length) onChange(clean[0], clean.slice(1).join(","));
    else onChange(m, clean.join(","));
  };
  const select = (
    sid: string,
    value: string,
    onPick: (v: string) => void,
    required?: boolean,
  ) => (
    <Select id={sid} value={value} onChange={(e) => onPick(e.target.value)}>
      <option value="">{required ? t("c.select") : t("c.none")}</option>
      {options
        .filter((o) => o.id === value || !chosen(value).has(o.id))
        .map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
    </Select>
  );
  const canAdd =
    !!main &&
    blank === 0 &&
    list.length < ORD.length &&
    options.length > list.length + 1;
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <FieldShell label={label} error={error} htmlFor={id}>
        {select(id, main, (v) => emit(v, list))}
      </FieldShell>
      {list.map((x, i) => (
        <FieldShell
          key={i}
          label={`${ORD[i]} ${sr ? "vozač" : "driver"}`}
          htmlFor={`${id}-${i}`}
        >
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              {select(`${id}-${i}`, x, (v) =>
                emit(
                  main,
                  list.map((y, j) => (j === i ? v : y)),
                ),
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label={sr ? "Ukloni" : "Remove"}
              onClick={() =>
                emit(main, list.filter((_, j) => j !== i).filter(Boolean))
              }
            >
              <Trash2 />
            </Button>
          </div>
        </FieldShell>
      ))}
      {canAdd && (
        <div className="flex items-end sm:col-span-2">
          <Button type="button" size="sm" onClick={() => setBlank(1)}>
            <Plus /> {ADD[list.length]}
          </Button>
        </div>
      )}
    </div>
  );
}

const ERR: Record<string, TKey> = {
  required: "c.required",
  number: "err.number",
  date: "err.date",
  option: "err.option",
  ref: "err.ref",
  duplicate: "err.duplicate",
  coords: "err.coords",
};

export function RecordForm({
  resource,
  record,
  refs,
  fixed,
  onDone,
  onCancel,
}: {
  resource: ResourceKey;
  record: Row | null;
  refs: Refs;
  fixed?: Record<string, string>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t, locale } = usePrefs();
  const fields = RESOURCES[resource].fields;
  const [values, setValues] = useState<Values>(() =>
    initialValues(fields, record, fixed),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (name: string, value: string | boolean) =>
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "entityType") {
        next.entityId = "";
        next.docType = "";
      }
      // Suggest an expiry from the document's typical validity (user can still change it).
      if (
        resource === "documents" &&
        (name === "docType" || name === "issuedAt") &&
        !prev.expiresAt
      ) {
        const days = DOC_VALIDITY_DAYS[String(next.docType)];
        const from = String(next.issuedAt || "") || todayISO();
        if (days && /^\d{4}-\d{2}-\d{2}$/.test(from))
          next.expiresAt = addDaysISO(from, days);
      }
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await saveRecord(resource, record?.id ?? null, values);
      if (res.ok) {
        router.refresh();
        onDone();
      } else {
        setErrors(res.errors);
        if (res.message) setMessage(res.message);
        else if (!Object.keys(res.errors).length) setMessage(t("err.generic"));
      }
    });
  };

  const renderField = (f: FieldDef) => {
    const id = `f-${resource}-${f.name}`;
    const err = errors[f.name]
      ? t(ERR[errors[f.name]] ?? "err.generic")
      : undefined;
    const label = (
      <>
        {t(f.label)}
        {f.required && <span className="text-ink-4"> *</span>}
      </>
    );
    const locked = fixed && f.name in fixed;
    if (locked) return null;
    if (f.showIf && String(values[f.showIf.field] ?? "") !== f.showIf.value)
      return null;
    const val = values[f.name];

    let control: ReactNode;
    switch (f.type) {
      case "textarea":
        control = (
          <TextArea
            id={id}
            value={String(val ?? "")}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
          />
        );
        break;
      case "int":
      case "decimal":
        control = (
          <TextInput
            id={id}
            inputMode="decimal"
            value={String(val ?? "")}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
            className="tnum"
          />
        );
        break;
      case "date":
        control = (
          <DateField
            id={id}
            value={String(val ?? "")}
            onChange={(v) => set(f.name, v)}
            required={f.required}
            invalid={!!err}
            presets={
              f.name === "expiresAt"
                ? expiryPresets(String(values.issuedAt || ""), locale)
                : undefined
            }
          />
        );
        break;
      case "bool":
        if (f.hint)
          return (
            <label
              key={f.name}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 py-1 text-sm",
                f.span === 2 && "sm:col-span-2",
              )}
            >
              <input
                type="checkbox"
                checked={Boolean(val)}
                onChange={(e) => set(f.name, e.target.checked)}
                className="mt-0.5 size-[18px] shrink-0 rounded accent-[var(--accent)]"
              />
              <span>
                <span className="block font-medium text-ink-2">
                  {t(f.label)}
                </span>
                <span className="block text-xs leading-snug text-ink-3">
                  {f.hint[locale]}
                </span>
              </span>
            </label>
          );
        return (
          <label
            key={f.name}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2.5 self-end text-sm font-medium text-ink-2",
              f.span === 2 && "sm:col-span-2",
            )}
          >
            <input
              type="checkbox"
              checked={Boolean(val)}
              onChange={(e) => set(f.name, e.target.checked)}
              className="size-[18px] rounded accent-[var(--accent)]"
            />
            {t(f.label)}
          </label>
        );
      case "money":
        control = (
          <div className="flex gap-2">
            <TextInput
              id={id}
              inputMode="decimal"
              value={String(val ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
              className="tnum"
              placeholder="0"
            />
            <Segmented
              size="sm"
              className="shrink-0 self-center"
              value={String(values.currency) as "EUR" | "RSD"}
              onChange={(c) => set("currency", c)}
              items={[
                { value: "EUR", label: "EUR" },
                { value: "RSD", label: "RSD" },
              ]}
            />
          </div>
        );
        break;
      case "select": {
        const opts = OPTION_SETS[f.options!];
        control = (
          <Select
            id={id}
            value={String(val ?? "")}
            onChange={(e) => set(f.name, e.target.value)}
            required={f.required}
          >
            <option value="">{t("c.select")}</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label[locale]}
              </option>
            ))}
          </Select>
        );
        break;
      }
      case "docType": {
        const opts =
          DOC_TYPES[(values.entityType as EntityType) || "vehicle"] ?? [];
        const regNote =
          values.docType === "registration" && values.entityType !== "employee"
            ? locale === "sr"
              ? "Šestomesečni pregled ovog vozila se sam pomera na 6 meseci od registracije."
              : "This vehicle's 6-month inspection moves to 6 months after the registration."
            : null;
        control = (
          <>
            <Select
              id={id}
              value={String(val ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
              required
            >
              <option value="">{t("c.select")}</option>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label[locale]}
                </option>
              ))}
            </Select>
            {regNote && <span className="text-xs text-ink-3">{regNote}</span>}
          </>
        );
        break;
      }
      case "ref":
      case "entity": {
        const key =
          f.type === "entity"
            ? (
                {
                  vehicle: "vehicles",
                  trailer: "trailers",
                  employee: "employees",
                } as const
              )[(values.entityType as EntityType) || "vehicle"]
            : f.ref!;
        const opts = refs[key] ?? [];
        control = (
          <Select
            id={id}
            value={String(val ?? "")}
            onChange={(e) => set(f.name, e.target.value)}
            required={f.required}
          >
            <option value="">{f.required ? t("c.select") : t("c.none")}</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
                {o.sub ? ` · ${o.sub}` : ""}
              </option>
            ))}
          </Select>
        );
        break;
      }
      case "links":
        return (
          <LinksField
            key={f.name}
            id={id}
            label={label}
            error={err}
            value={String(val ?? "")}
            options={refs[f.ref!] ?? []}
            onChange={(v) => set(f.name, v)}
          />
        );
      case "drivers":
        return (
          <DriversField
            key={f.name}
            id={id}
            label={label}
            error={err}
            main={String(val ?? "")}
            extras={String(values.extraDriverIds ?? "")}
            options={refs[f.ref ?? "drivers"] ?? []}
            onChange={(main, extras) => {
              set(f.name, main);
              set("extraDriverIds", extras);
            }}
          />
        );
      case "coords":
        return (
          <FieldShell
            key={f.name}
            label={label}
            error={err}
            span={f.span}
            htmlFor={id}
          >
            <TextInput
              id={id}
              value={String(val ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              inputMode="text"
            />
            {!err && (
              <span className="text-xs text-ink-3">
                {locale === "sr"
                  ? "Nalepi link sa Google mapa ili upiši „širina, dužina“. Ako ostaviš prazno, lokaciju tražimo po adresi."
                  : "Paste a Google Maps link or type “lat, lng”. Leave empty to look it up by the address."}
              </span>
            )}
          </FieldShell>
        );
      case "supplier":
        control = (
          <SupplierPicker
            id={id}
            value={String(val ?? "")}
            options={refs.suppliers ?? []}
            onChange={(v) => set(f.name, v)}
          />
        );
        break;
      case "month":
        control = (
          <MonthField
            id={id}
            value={String(val ?? "")}
            onChange={(v) => set(f.name, v)}
          />
        );
        break;
      default:
        control = (
          <TextInput
            id={id}
            value={String(val ?? "")}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
          />
        );
    }
    return (
      <FieldShell
        key={f.name}
        label={label}
        error={err}
        span={f.span}
        htmlFor={id}
      >
        {control}
        {f.hint && !err && (
          <span className="text-xs leading-snug text-ink-3">
            {f.hint[locale]}
          </span>
        )}
      </FieldShell>
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
        {fields.map(renderField)}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3">
        <span className="text-sm text-bad">{message}</span>
        <div className="flex gap-2">
          <Button onClick={onCancel}>{t("c.cancel")}</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? t("c.saving") : t("c.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** One hook per table: open create/edit modals and delete confirmation for a resource. */
export function useCrud(
  resource: ResourceKey,
  refs: Refs,
  fixed?: Record<string, string>,
) {
  const { t, can } = usePrefs();
  const canEdit =
    resource === "suppliers" || resource === "places"
      ? can("suppliers", "edit")
      : can(RESOURCE_MODULE[resource], "edit");
  const router = useRouter();
  const [editing, setEditing] = useState<{ record: Row | null } | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const titleNoun = t(RESOURCES[resource].title);

  const node = (
    <>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`${editing?.record ? t("c.edit") : t("c.add")} ${titleNoun}`}
      >
        {editing && (
          <RecordForm
            key={editing.record?.id ?? "new"}
            resource={resource}
            record={editing.record}
            refs={refs}
            fixed={fixed}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`${t("c.delete")} ${titleNoun}`}
      >
        <p className="px-4 py-4 text-sm leading-relaxed text-ink-2">
          {t("c.confirmDelete")}
        </p>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
          <Button onClick={() => setDeleting(null)}>{t("c.cancel")}</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (deleting) await deleteRecord(resource, deleting.id);
                setDeleting(null);
                router.refresh();
              })
            }
          >
            <Trash2 />
            {t("c.delete")}
          </Button>
        </div>
      </Modal>
    </>
  );

  const menu = (row: Row, extra: MenuItem[] = []): MenuItem[] => [
    ...extra,
    ...(canEdit
      ? [
          {
            label: t("c.edit"),
            icon: <Pencil />,
            onSelect: () => setEditing({ record: row }),
          },
          {
            label: t("c.delete"),
            icon: <Trash2 />,
            onSelect: () => setDeleting(row),
            danger: true,
          },
        ]
      : []),
  ];

  return useMemo(
    () => ({
      canEdit,
      create: () => setEditing({ record: null }),
      edit: (row: Row) => setEditing({ record: row }),
      remove: (row: Row) => setDeleting(row),
      menu,
      node,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, deleting, pending, refs, fixed, t, canEdit],
  );
}
