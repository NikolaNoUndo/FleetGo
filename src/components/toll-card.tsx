"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Pencil, RefreshCw } from "lucide-react";
import { calcToll, setTollManual } from "@/app/actions";
import { Button } from "./ui/primitives";
import { InfoTip, Select, TextInput } from "./ui/client";

export type TollView = {
  /** which amount counts for the tour */
  source: "manual" | "calc" | null;
  totalFmt: string | null;
  manual: { amount: number; currency: string } | null;
  calc: {
    totalFmt: string;
    at: string;
    axles: number;
    trackKm: number;
    rows: { country: string; name: string; km: number; amountFmt: string; rate: string; estimated: boolean }[];
    notes: string[];
    stale: boolean;
  } | null;
};

/** Road tolls on a tour: worked out from tracking, or typed in from the invoice. */
export function TollCard({ tourId, canEdit, view, sr }: { tourId: string; canEdit: boolean; view: TollView; sr: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(view.manual ? String(view.manual.amount).replace(".", ",") : "");
  const [currency, setCurrency] = useState(view.manual?.currency ?? "EUR");

  const run = (fn: () => Promise<{ ok: true } | { ok: false; message: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn().catch(() => ({ ok: false as const, message: sr ? "Nije uspelo, probaj ponovo." : "That didn't work, try again." }));
      if (!r.ok) return setError(r.message);
      after?.();
      router.refresh();
    });

  const c = view.calc;
  const when = c ? new Intl.DateTimeFormat(sr ? "sr-Latn-RS" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(c.at)) : null;

  return (
    <div className="px-4 pt-1 pb-4">
      <div className="flex items-baseline justify-between gap-3 py-2">
        <div>
          <div className="text-xs text-ink-3">{view.source === "manual" ? (sr ? "Upisano ručno" : "Typed in") : view.source === "calc" ? (sr ? "Iz praćenja, oko ±10 %" : "From tracking, about ±10%") : sr ? "Još nije izračunato" : "Not worked out yet"}</div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight tnum">{view.totalFmt ?? "—"}</div>
        </div>
        {canEdit && (
          <div className="flex gap-1.5">
            <Button size="sm" disabled={pending} onClick={() => run(() => calcToll(tourId))} title={sr ? "Izračunaj iz trase kamiona" : "Work out from the truck's track"}>
              {c ? <RefreshCw /> : <Calculator />} {pending ? (sr ? "Računam…" : "Working…") : c ? (sr ? "Ponovo" : "Again") : sr ? "Izračunaj" : "Calculate"}
            </Button>
            <Button size="sm" disabled={pending} onClick={() => setEditing((x) => !x)} title={sr ? "Upiši iznos sa računa" : "Type the invoiced amount"}>
              <Pencil />
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mb-2 rounded-md bg-bad-soft px-2.5 py-2 text-xs leading-relaxed text-bad-ink">{error}</p>}

      {editing && canEdit && (
        <form
          className="mb-3 flex flex-col gap-2 rounded-lg border border-line bg-surface-2/60 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setTollManual(tourId, amount, currency), () => setEditing(false));
          }}
        >
          <label className="text-xs text-ink-2" htmlFor={`toll-${tourId}`}>
            {sr ? "Putarina sa računa (TAG, ENC, DKV…). Kad je upisana, računa se umesto procene." : "Tolls from the invoice. When set, it is used instead of the estimate."}
          </label>
          <div className="flex gap-2">
            <TextInput id={`toll-${tourId}`} inputMode="decimal" className="tnum" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24">
              <option value="EUR">EUR</option>
              <option value="RSD">RSD</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            {view.manual && (
              <Button size="sm" type="button" disabled={pending} onClick={() => run(() => setTollManual(tourId, null, currency), () => (setAmount(""), setEditing(false)))}>
                {sr ? "Obriši ručni iznos" : "Clear"}
              </Button>
            )}
            <Button size="sm" variant="primary" type="submit" disabled={pending}>
              {sr ? "Sačuvaj" : "Save"}
            </Button>
          </div>
        </form>
      )}

      {c && (
        <div className="divide-y divide-line/70 text-sm">
          {c.rows.length === 0 ? (
            <p className="py-2 text-xs text-ink-3">{sr ? `Na trasi (${c.trackKm} km) nema puteva pod naplatom.` : `No tolled roads on the track (${c.trackKm} km).`}</p>
          ) : (
            c.rows.map((r) => (
              <div key={r.country} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-7 shrink-0 rounded bg-surface-3 px-1 py-0.5 text-center text-[11px] font-semibold text-ink-2">{r.country}</span>
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-xs text-ink-3 tnum">{r.km.toLocaleString(sr ? "sr-Latn-RS" : "en-GB", { maximumFractionDigits: 0 })} km</span>
                </span>
                <span className="flex items-center gap-1 tnum text-ink-2">
                  {r.amountFmt}
                  <InfoTip>
                    {r.rate}
                    {r.estimated ? (sr ? " (procena za ovaj broj osovina)" : " (estimate for this axle count)") : ""}
                  </InfoTip>
                </span>
              </div>
            ))
          )}
          {view.source === "manual" && <div className="flex justify-between py-2 text-xs text-ink-3"><span>{sr ? "Procena iz praćenja" : "Estimate from tracking"}</span><span className="tnum">{c.totalFmt}</span></div>}
        </div>
      )}

      {c && (
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          {sr
            ? `Km po putevima pod naplatom iz praćenja × prosečna cena po km za ${c.axles} osovina. Izračunato ${when}.`
            : `Km on tolled roads from tracking × average price per km for ${c.axles} axles. Worked out ${when}.`}
          {c.stale && <span className="mt-1 block text-warn-ink">{sr ? "Datumi, vreme ili kamion ture su menjani posle računanja; izračunaj ponovo." : "The tour's dates, times or truck changed since; calculate again."}</span>}
          {c.notes.map((n) => (
            <span key={n} className="mt-1 block">{n}</span>
          ))}
        </p>
      )}
      {!c && !view.manual && (
        <p className="text-xs leading-relaxed text-ink-3">
          {sr
            ? "Putarina se računa iz trase kamiona u praćenju: km po putevima pod naplatom u Srbiji, Hrvatskoj, Sloveniji, Italiji, Francuskoj, Mađarskoj, Austriji i Nemačkoj × cena po km za broj osovina. Za tačno vreme upiši vreme polaska i povratka na turi."
            : "Tolls are worked out from the truck's track: km on tolled roads in Serbia, Croatia, Slovenia, Italy, France, Hungary, Austria and Germany × the price per km for the axle count. Enter departure and return times on the tour for an exact window."}
        </p>
      )}
    </div>
  );
}
