"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { saveRecord, deleteRecord } from "@/app/actions";
import { RESOURCES, type FieldDef, type Refs, type ResourceKey } from "@/lib/resources";
import { DOC_TYPES, DOC_VALIDITY_DAYS, OPTION_SETS, addDaysISO, type EntityType } from "@/lib/catalog";
import { todayISO } from "@/lib/format";
import { usePrefs } from "./prefs";
import { Button, cn } from "./ui/primitives";
import { FieldShell, Modal, Segmented, Select, TextArea, TextInput, type MenuItem } from "./ui/client";
import type { TKey } from "@/lib/i18n";

type Values = Record<string, string | boolean>;
type Row = Record<string, unknown> & { id: string };

function initialValues(fields: FieldDef[], record: Row | null, fixed?: Record<string, string>): Values {
  const v: Values = {};
  for (const f of fields) {
    const raw = record?.[f.name];
    if (f.type === "bool") v[f.name] = record ? Boolean(raw) : Boolean(f.defaultValue ?? false);
    else if (f.type === "money") {
      v[f.name] = raw === null || raw === undefined ? "" : String(raw);
      v.currency = String(record?.currency ?? f.defaultValue ?? "RSD");
    } else if (raw !== null && raw !== undefined) v[f.name] = String(raw);
    else if (!record && f.type === "date" && f.required) v[f.name] = todayISO();
    else v[f.name] = f.defaultValue !== undefined ? String(f.defaultValue) : "";
  }
  if (fixed) Object.assign(v, fixed);
  return v;
}

const ERR: Record<string, TKey> = {
  required: "c.required",
  number: "err.number",
  date: "err.date",
  option: "err.option",
  ref: "err.ref",
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
  const [values, setValues] = useState<Values>(() => initialValues(fields, record, fixed));
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
      if (resource === "documents" && (name === "docType" || name === "issuedAt") && !prev.expiresAt) {
        const days = DOC_VALIDITY_DAYS[String(next.docType)];
        const from = String(next.issuedAt || "") || todayISO();
        if (days && /^\d{4}-\d{2}-\d{2}$/.test(from)) next.expiresAt = addDaysISO(from, days);
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
    const err = errors[f.name] ? t(ERR[errors[f.name]] ?? "err.generic") : undefined;
    const label = (
      <>
        {t(f.label)}
        {f.required && <span className="text-ink-4"> *</span>}
      </>
    );
    const locked = fixed && f.name in fixed;
    if (locked) return null;
    const val = values[f.name];

    let control: ReactNode;
    switch (f.type) {
      case "textarea":
        control = <TextArea id={id} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />;
        break;
      case "int":
      case "decimal":
        control = (
          <TextInput id={id} inputMode="decimal" value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} className="tnum" />
        );
        break;
      case "date":
        control = <TextInput id={id} type="date" value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
        break;
      case "bool":
        return (
          <label key={f.name} className={cn("flex h-10 cursor-pointer items-center gap-2.5 self-end text-[14px] font-medium text-ink-2", f.span === 2 && "sm:col-span-2")}>
            <input type="checkbox" checked={Boolean(val)} onChange={(e) => set(f.name, e.target.checked)} className="size-[18px] rounded accent-[var(--accent)]" />
            {t(f.label)}
          </label>
        );
      case "money":
        control = (
          <div className="flex gap-2">
            <TextInput id={id} inputMode="decimal" value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} className="tnum" placeholder="0" />
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
          <Select id={id} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} required={f.required}>
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
        const opts = DOC_TYPES[(values.entityType as EntityType) || "vehicle"] ?? [];
        control = (
          <Select id={id} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} required>
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
      case "ref":
      case "entity": {
        const key = f.type === "entity" ? ({ vehicle: "vehicles", trailer: "trailers", employee: "employees" } as const)[(values.entityType as EntityType) || "vehicle"] : f.ref!;
        const opts = refs[key] ?? [];
        control = (
          <Select id={id} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} required={f.required}>
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
      default:
        control = <TextInput id={id} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />;
    }
    return (
      <FieldShell key={f.name} label={label} error={err} span={f.span} htmlFor={id}>
        {control}
      </FieldShell>
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">{fields.map(renderField)}</div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3.5">
        <span className="text-[13px] text-bad">{message}</span>
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
export function useCrud(resource: ResourceKey, refs: Refs, fixed?: Record<string, string>) {
  const { t } = usePrefs();
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
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`${t("c.delete")} ${titleNoun}`}>
        <p className="px-5 py-5 text-[14px] leading-relaxed text-ink-2">{t("c.confirmDelete")}</p>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3.5">
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
            <Trash2 size={15} />
            {t("c.delete")}
          </Button>
        </div>
      </Modal>
    </>
  );

  const menu = (row: Row, extra: MenuItem[] = []): MenuItem[] => [
    ...extra,
    { label: t("c.edit"), icon: <Pencil />, onSelect: () => setEditing({ record: row }) },
    { label: t("c.delete"), icon: <Trash2 />, onSelect: () => setDeleting(row), danger: true },
  ];

  return useMemo(
    () => ({
      create: () => setEditing({ record: null }),
      edit: (row: Row) => setEditing({ record: row }),
      remove: (row: Row) => setDeleting(row),
      menu,
      node,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, deleting, pending, refs, fixed, t],
  );
}
