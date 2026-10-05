"use client";

import { Plus, X } from "lucide-react";
import { usePrefs } from "./prefs";
import { SupplierPicker } from "./record-form";
import { DateField } from "./ui/date-field";
import { FieldShell, Segmented, TextInput } from "./ui/client";
import { Button } from "./ui/primitives";
import type { Refs } from "@/lib/resources";
import type { TKey } from "@/lib/i18n";

export type LegDraft = {
  key: string;
  id?: string;
  fromPlace: string;
  toPlace: string;
  date: string;
  clientId: string;
  price: string;
  currency: string;
  distanceKm: string;
  notes: string;
};

let seq = 0;
export const newLeg = (from = ""): LegDraft => ({
  key: `n${++seq}`,
  fromPlace: from,
  toPlace: "",
  date: "",
  clientId: "",
  price: "",
  currency: "EUR",
  distanceKm: "",
  notes: "",
});

/** legs of an existing tour (as sent to the page) → editable rows */
export function legDrafts(raw: unknown): LegDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: Record<string, unknown>) => ({
    key: String(l.id ?? `n${++seq}`),
    id: typeof l.id === "string" ? l.id : undefined,
    fromPlace: String(l.fromPlace ?? ""),
    toPlace: String(l.toPlace ?? ""),
    date: String(l.date ?? ""),
    clientId: String(l.clientId ?? ""),
    price: l.price === null || l.price === undefined ? "" : String(l.price),
    currency: String(l.currency ?? "EUR"),
    distanceKm:
      l.distanceKm === null || l.distanceKm === undefined
        ? ""
        : String(l.distanceKm),
    notes: String(l.notes ?? ""),
  }));
}

const ERR: Record<string, TKey> = {
  required: "c.required",
  number: "err.number",
  date: "err.date",
  ref: "err.ref",
  option: "err.option",
};

/**
 * The legs of a tour inside the tour form: Čačak → Beograd, Beograd → Kraljevo, …
 * One row per load, each with its own client and price; a new row starts where the
 * last one ended.
 */
export function LegsEditor({
  legs,
  onChange,
  refs,
  errors,
  canPrice,
}: {
  legs: LegDraft[];
  onChange: (l: LegDraft[]) => void;
  refs: Refs;
  errors: Record<string, string>;
  canPrice: boolean;
}) {
  const { t, locale, money, conv, currency } = usePrefs();
  const sr = locale === "sr";
  const set = (i: number, patch: Partial<LegDraft>) =>
    onChange(legs.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const err = (i: number, f: string) =>
    errors[`legs.${i}.${f}`]
      ? t(ERR[errors[`legs.${i}.${f}`]] ?? "err.generic")
      : undefined;
  const total = legs.reduce(
    (s, l) =>
      s +
      (Number(l.price.replace(",", "."))
        ? conv(Number(l.price.replace(",", ".")), l.currency)
        : 0),
    0,
  );

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          {sr ? "Vožnje u turi" : "Legs of the tour"}
        </h3>
        {canPrice && total > 0 && (
          <span className="text-xs text-ink-3">
            {sr ? "Ukupno" : "Total"}{" "}
            <b className="font-semibold text-ink tnum">
              {money(total, currency)}
            </b>
          </span>
        )}
      </div>
      <ol className="flex flex-col gap-2.5">
        {legs.map((l, i) => {
          const id = (f: string) => `leg-${l.key}-${f}`;
          return (
            <li
              key={l.key}
              className="relative rounded-xl border border-line bg-surface-2/50 p-3 pt-2.5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-3">
                  {sr ? "Vožnja" : "Leg"} {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(legs.filter((_, j) => j !== i))}
                  aria-label={sr ? "Ukloni vožnju" : "Remove leg"}
                  className="focus-ring -mr-1 grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
                <FieldShell
                  label={t("f.fromPlace")}
                  htmlFor={id("from")}
                  error={err(i, "fromPlace")}
                >
                  <TextInput
                    id={id("from")}
                    value={l.fromPlace}
                    onChange={(e) => set(i, { fromPlace: e.target.value })}
                    placeholder="Čačak"
                  />
                </FieldShell>
                <FieldShell
                  label={t("f.toPlace")}
                  htmlFor={id("to")}
                  error={err(i, "toPlace")}
                >
                  <TextInput
                    id={id("to")}
                    value={l.toPlace}
                    onChange={(e) => set(i, { toPlace: e.target.value })}
                    placeholder="Beograd"
                  />
                </FieldShell>
                <div className="col-span-2">
                  <FieldShell
                    label={t("f.client")}
                    htmlFor={id("client")}
                    error={err(i, "clientId")}
                  >
                    <SupplierPicker
                      id={id("client")}
                      value={l.clientId}
                      options={refs.clients ?? []}
                      onChange={(v) => set(i, { clientId: v })}
                    />
                  </FieldShell>
                </div>
                {canPrice && (
                  <div className="col-span-2">
                    <FieldShell
                      label={t("f.legPrice")}
                      htmlFor={id("price")}
                      error={err(i, "price")}
                    >
                      <div className="flex gap-2">
                        <TextInput
                          id={id("price")}
                          inputMode="decimal"
                          value={l.price}
                          onChange={(e) => set(i, { price: e.target.value })}
                          className="tnum"
                          placeholder="0"
                        />
                        <Segmented
                          size="sm"
                          className="shrink-0 self-center"
                          value={l.currency as "EUR" | "RSD"}
                          onChange={(c) => set(i, { currency: c })}
                          items={[
                            { value: "EUR", label: "EUR" },
                            { value: "RSD", label: "RSD" },
                          ]}
                        />
                      </div>
                    </FieldShell>
                  </div>
                )}
                <FieldShell
                  label={t("f.date")}
                  htmlFor={id("date")}
                  error={err(i, "date")}
                >
                  <DateField
                    id={id("date")}
                    value={l.date}
                    onChange={(v) => set(i, { date: v })}
                    invalid={!!err(i, "date")}
                  />
                </FieldShell>
                <FieldShell
                  label={t("f.distanceKm")}
                  htmlFor={id("km")}
                  error={err(i, "distanceKm")}
                >
                  <TextInput
                    id={id("km")}
                    inputMode="numeric"
                    value={l.distanceKm}
                    onChange={(e) => set(i, { distanceKm: e.target.value })}
                    className="tnum"
                  />
                </FieldShell>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        className="mt-2.5 w-full border-dashed"
        onClick={() => onChange([...legs, newLeg(legs.at(-1)?.toPlace ?? "")])}
      >
        <Plus /> {sr ? "Dodaj vožnju" : "Add a leg"}
      </Button>
      <p className="mt-1.5 text-xs text-ink-3">
        {sr
          ? "Upiši one koje već znaš. Ostale možeš da dodaš kasnije, kroz Izmeni."
          : "Enter the ones you know now. Add the rest later with Edit."}
      </p>
    </div>
  );
}
