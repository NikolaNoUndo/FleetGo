"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renewDocument } from "@/app/actions";
import { DOC_TYPES, DOC_VALIDITY_DAYS, type EntityType } from "@/lib/catalog";
import { addMonthsDate } from "@/lib/expenses";
import { todayISO } from "@/lib/format";
import { usePrefs } from "./prefs";
import { Button, cn } from "./ui/primitives";
import { FieldShell, Modal, Segmented, TextInput } from "./ui/client";
import { DateField, toDisplay } from "./ui/date-field";
import type { DocRow } from "./tables/records";

type Period = "6" | "12" | "36" | "other";
type From = "renewal" | "old";

const yesterday = () => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Typical validity of this document, as one of the quick choices when possible. */
function defaultPeriod(doc: DocRow): { period: Period; months: number } {
  let days = DOC_VALIDITY_DAYS[doc.docType] ?? 365;
  if (doc.issuedAt && doc.expiresAt) days = Math.max(1, Math.round((Date.parse(doc.expiresAt) - Date.parse(doc.issuedAt)) / 86_400_000));
  const months = Math.max(1, Math.round(days / 30.44));
  if (Math.abs(months - 6) <= 1) return { period: "6", months: 6 };
  if (Math.abs(months - 12) <= 1) return { period: "12", months: 12 };
  if (Math.abs(months - 36) <= 2) return { period: "36", months: 36 };
  return { period: "other", months };
}

function RenewForm({ doc, onDone }: { doc: DocRow; onDone: () => void }) {
  const { t, opt, locale, can } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = todayISO();
  const docLabel = opt(DOC_TYPES[doc.entityType as EntityType] ?? [], doc.docType);
  const oldExp = doc.expiresAt;
  const init = defaultPeriod(doc);

  const [issued, setIssued] = useState(today);
  const [period, setPeriod] = useState<Period>(init.period);
  // renewed while the old one is still valid: by default the new term continues from the old expiry
  const [from, setFrom] = useState<From>(oldExp && oldExp >= today ? "old" : "renewal");
  const [otherMonths] = useState(init.months);
  const [manual, setManual] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "RSD">(doc.currency === "EUR" ? "EUR" : "RSD");
  const [addExpense, setAddExpense] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const base = from === "old" && oldExp ? oldExp : /^\d{4}-\d{2}-\d{2}$/.test(issued) ? issued : today;
  const months = period === "other" ? otherMonths : Number(period);
  const computed = addMonthsDate(base, months);
  const expires = manual ?? computed;
  const canExpense = can("expenses", "edit");
  const isVehicleDoc = doc.entityType === "vehicle" || doc.entityType === "trailer";

  const choose = (p: Period) => {
    setPeriod(p);
    if (p !== "other") setManual(null);
  };
  const err = (k: string) => (errors[k] ? (errors[k] === "number" ? t("err.number") : t("err.date")) : undefined);

  const submit = () =>
    start(async () => {
      setMessage(null);
      const res = await renewDocument(doc.id, {
        issuedAt: /^\d{4}-\d{2}-\d{2}$/.test(issued) ? issued : "",
        expiresAt: expires,
        number,
        amount,
        currency,
        addExpense: addExpense && canExpense,
        label: `${docLabel} – ${doc.ownerName}`,
      });
      if (res.ok) {
        router.refresh();
        onDone();
      } else {
        setErrors(res.errors);
        setMessage(res.message ?? (Object.keys(res.errors).length ? null : t("err.generic")));
      }
    });

  const monthsLabel = (n: number) => (sr ? (n % 12 === 0 ? `${n / 12} ${n === 12 ? "godina" : n / 12 < 5 ? "godine" : "godina"}` : `${n} meseci`) : n % 12 === 0 ? `${n / 12} year${n === 12 ? "" : "s"}` : `${n} months`);

  return (
    <div>
      <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-2/70 px-3 py-2 text-sm sm:col-span-2">
          <span className="font-medium">{docLabel}</span> · {doc.ownerName}
          <span className="block text-xs text-ink-3">
            {oldExp ? (sr ? `Do sada važi do ${toDisplay(oldExp)}` : `Currently valid until ${toDisplay(oldExp)}`) : sr ? "Bez roka" : "No expiry"}
            {doc.number ? ` · ${sr ? "br." : "no."} ${doc.number}` : ""}
          </span>
        </div>

        <FieldShell label={sr ? "Datum obnove" : "Renewal date"} error={err("issuedAt")} htmlFor="rn-issued">
          <DateField id="rn-issued" value={issued} onChange={setIssued} presets={[{ label: sr ? "Juče" : "Yesterday", value: yesterday() }]} />
        </FieldShell>

        <FieldShell label={sr ? "Važi" : "Valid for"}>
          <Segmented
            size="sm"
            value={period}
            onChange={choose}
            items={[
              { value: "6", label: sr ? "6 meseci" : "6 months" },
              { value: "12", label: sr ? "1 godina" : "1 year" },
              { value: "36", label: sr ? "3 godine" : "3 years" },
              { value: "other", label: sr ? "Drugo" : "Other" },
            ]}
          />
        </FieldShell>

        {oldExp && (
          <FieldShell label={sr ? "Računa se od" : "Counted from"} span={2}>
            <Segmented
              size="sm"
              value={from}
              onChange={(v) => {
                setFrom(v);
                if (period !== "other") setManual(null);
              }}
              items={[
                { value: "renewal", label: sr ? `datuma obnove${issued ? ` (${toDisplay(issued)})` : ""}` : `renewal date${issued ? ` (${toDisplay(issued)})` : ""}` },
                { value: "old", label: sr ? `isteka starog (${toDisplay(oldExp)})` : `old expiry (${toDisplay(oldExp)})` },
              ]}
            />
          </FieldShell>
        )}

        <FieldShell label={sr ? "Novi rok isteka" : "New expiry"} error={err("expiresAt")} span={2} htmlFor="rn-expires">
          <DateField
            id="rn-expires"
            value={expires}
            required
            onChange={(v) => {
              setManual(v);
              if (v !== computed) setPeriod("other");
            }}
          />
          {!errors.expiresAt && (
            <span className={cn("text-xs", manual && manual !== computed ? "text-warn-ink" : "text-ink-3")}>
              {manual && manual !== computed
                ? sr
                  ? "Ručno podešeno."
                  : "Set by hand."
                : sr
                  ? `${monthsLabel(months)} od ${toDisplay(base)} — možeš ga i ručno pomeriti.`
                  : `${monthsLabel(months)} from ${toDisplay(base)} — you can also adjust it by hand.`}
            </span>
          )}
        </FieldShell>

        <FieldShell label={sr ? "Novi broj dokumenta (neobavezno)" : "New document number (optional)"} htmlFor="rn-number">
          <TextInput id="rn-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={doc.number ?? ""} />
        </FieldShell>

        <FieldShell label={sr ? "Cena (neobavezno)" : "Price (optional)"} error={err("amount")} htmlFor="rn-amount">
          <div className="flex gap-2">
            <TextInput id="rn-amount" inputMode="decimal" className="tnum" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Segmented
              size="sm"
              className="shrink-0 self-center"
              value={currency}
              onChange={setCurrency}
              items={[
                { value: "EUR", label: "EUR" },
                { value: "RSD", label: "RSD" },
              ]}
            />
          </div>
        </FieldShell>

        {canExpense && amount.trim() !== "" && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm sm:col-span-2">
            <input type="checkbox" checked={addExpense} onChange={(e) => setAddExpense(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 rounded accent-[var(--accent)]" />
            <span>
              <span className="block font-medium text-ink-2">{sr ? "Upiši cenu i u troškove" : "Also add the price to costs"}</span>
              <span className="block text-xs text-ink-3">
                {sr
                  ? `Ostali troškovi → Registracija i dokumenta${isVehicleDoc ? `, za ${doc.ownerName}` : ""}.`
                  : `Other costs → Registration & documents${isVehicleDoc ? `, for ${doc.ownerName}` : ""}.`}
              </span>
            </span>
          </label>
        )}

        {doc.docType === "registration" && isVehicleDoc && (
          <p className="text-xs text-ink-3 sm:col-span-2">
            {sr ? "Šestomesečni pregled ovog vozila se sam pomera na 6 meseci od datuma obnove." : "This vehicle's 6-month inspection moves to 6 months after the renewal date."}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3">
        <span className="text-sm text-bad">{message}</span>
        <div className="flex gap-2">
          <Button onClick={onDone}>{t("c.cancel")}</Button>
          <Button variant="primary" disabled={pending} onClick={submit}>
            {pending ? t("c.saving") : sr ? "Obnovi" : "Renew"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RenewDialog({ doc, onClose }: { doc: DocRow | null; onClose: () => void }) {
  const { locale } = usePrefs();
  return (
    <Modal open={!!doc} onClose={onClose} title={locale === "sr" ? "Obnova dokumenta" : "Renew document"}>
      {doc && <RenewForm key={doc.id} doc={doc} onDone={onClose} />}
    </Modal>
  );
}
