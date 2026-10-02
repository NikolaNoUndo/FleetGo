"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleAlert, Container, Download, FileSpreadsheet, RefreshCw, Truck, Upload, Users } from "lucide-react";
import Link from "@/components/ui/link";
import { usePrefs } from "./prefs";
import { Badge, Button, btnClass, cn } from "./ui/primitives";
import { Modal } from "./ui/client";
import type { ImportPreview, ImportResult, ImportSheet, PreviewRow } from "@/lib/fleet-import/types";

const TEMPLATE_URL = "/api/import/template";

const SHEET_META: Record<ImportSheet, { icon: typeof Truck; sr: string; en: string }> = {
  employees: { icon: Users, sr: "Vozači", en: "Drivers" },
  trailers: { icon: Container, sr: "Prikolice", en: "Trailers" },
  vehicles: { icon: Truck, sr: "Kamioni", en: "Trucks" },
};

/** Serbian plural: 1 kamion, 2 kamiona, 5 kamiona → forms[one, few, many] */
const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const dd = n % 100;
  return d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
};

async function send(file: File, mode: "preview" | "commit") {
  const body = new FormData();
  body.set("file", file);
  body.set("mode", mode);
  const res = await fetch("/api/import", { method: "POST", body });
  try {
    return await res.json();
  } catch {
    return { ok: false, message: `HTTP ${res.status}` };
  }
}

/**
 * Fleet import from Excel: download the workbook (Kamioni, Prikolice, Vozači; the
 * documents are expiry-date columns in the same rows), fill it in, upload it, see
 * what will happen, import. Nothing is saved before the last click.
 */
export function FleetImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  // pages refresh only when the dialog closes: on the overview the empty-fleet card
  // holding this dialog goes away once there is a fleet
  const imported = useRef(false);
  const close = () => {
    onClose();
    if (imported.current) {
      imported.current = false;
      router.refresh();
    }
  };
  return (
    <Modal open={open} onClose={close} wide title={sr ? "Uvoz iz Excela" : "Import from Excel"}>
      {open && <ImportFlow onClose={close} onImported={() => (imported.current = true)} />}
    </Modal>
  );
}

function ImportFlow({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Extract<ImportPreview, { ok: true }> | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [drag, setDrag] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setError(null);
    setBusy("preview");
    try {
      const res = (await send(f, "preview")) as ImportPreview;
      if (res.ok) setPreview(res);
      else setError(res.message);
    } catch {
      setError(sr ? "Veza je pukla. Pokušaj ponovo." : "Connection failed. Try again.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy("commit");
    setError(null);
    try {
      const res = (await send(file, "commit")) as ImportResult;
      if (res.ok) {
        setResult(res);
        onImported();
      } else setError(res.message);
    } catch {
      setError(sr ? "Veza je pukla. Ništa nije sačuvano, pokušaj ponovo." : "Connection failed. Nothing was saved, try again.");
    } finally {
      setBusy(null);
    }
  };

  const toImport = preview ? preview.sheets.reduce((s, x) => s + x.added + x.updated, 0) : 0;
  const errors = preview ? preview.sheets.reduce((s, x) => s + x.errors, 0) : 0;

  /* ── done ── */
  if (result) {
    return (
      <div>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-good-soft text-good">
            <CheckCircle2 size={24} />
          </span>
          <h3 className="mt-4 text-base font-semibold text-ink">{sr ? "Uvoz je završen" : "Import finished"}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-ink-2">
            {sr
              ? `Dodato ${result.added}, dopunjeno ${result.updated}, rokova ${result.docs}.${result.skipped ? ` Preskočeno ${result.skipped} ${pl(result.skipped, "red", "reda", "redova")} sa greškom.` : ""}`
              : `${result.added} added, ${result.updated} updated, ${result.docs} expiry dates.${result.skipped ? ` ${result.skipped} rows with errors skipped.` : ""}`}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
          <Button onClick={onClose}>{sr ? "Zatvori" : "Close"}</Button>
          <Link href="/vehicles" onClick={onClose} className={btnClass("primary")}>
            {sr ? "Pogledaj flotu" : "View the fleet"}
          </Link>
        </div>
      </div>
    );
  }

  const fileInput = (
    <input ref={input} type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
  );

  /* ── preview ── */
  if (preview && file) {
    const issueRows = preview.rows.filter((r) => r.issues.length).sort((a, b) => Number(b.action === "error") - Number(a.action === "error"));
    const ignored = preview.sheets.filter((s) => s.ignored.length);
    return (
      <div>
        <div className="max-h-[calc(94dvh-128px)] overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[65vh] sm:px-5">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
            <FileSpreadsheet size={18} className="shrink-0 text-good" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{file.name}</span>
            <label className={cn(btnClass("ghost", "sm"), "cursor-pointer")}>
              <RefreshCw size={13} /> {sr ? "Drugi fajl" : "Another file"}
              {fileInput}
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {preview.sheets.map((s) => {
              const meta = SHEET_META[s.sheet];
              const Icon = meta.icon;
              const nothing = !s.name || !s.allowed || s.added + s.updated + s.errors === 0;
              return (
                <div key={s.sheet} className={cn("rounded-lg border border-line px-3.5 py-3", nothing && "bg-surface-2/50")}>
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Icon size={15} className="text-ink-3" />
                    {sr ? meta.sr : meta.en}
                  </div>
                  {!s.name ? (
                    <p className="mt-1.5 text-xs text-ink-3">{sr ? "Nema ovog lista u fajlu" : "Not in the file"}</p>
                  ) : !s.allowed ? (
                    <p className="mt-1.5 text-xs text-warn-ink">{sr ? "Nemaš pravo izmene, preskače se" : "No edit access, skipped"}</p>
                  ) : (
                    <div className="mt-1.5 space-y-0.5 text-xs text-ink-2 tnum">
                      <div>
                        <span className="font-semibold text-ink">{s.added}</span> {sr ? pl(s.added, "novi", "nova", "novih") : "new"}
                        {s.updated > 0 && (
                          <>
                            {" · "}
                            <span className="font-semibold text-ink">{s.updated}</span> {sr ? "dopunjuje" : "update"}
                          </>
                        )}
                      </div>
                      {preview.docsAllowed && (
                        <div>
                          <span className="font-semibold text-ink">{s.docs}</span> {sr ? pl(s.docs, "rok", "roka", "rokova") : s.docs === 1 ? "expiry date" : "expiry dates"}
                        </div>
                      )}
                      {s.errors > 0 && (
                        <div className="text-bad-ink">
                          {s.errors} {sr ? `${pl(s.errors, "red", "reda", "redova")} sa greškom` : s.errors === 1 ? "row with an error" : "rows with errors"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!preview.docsAllowed && (
            <p className="mt-3 text-xs text-warn-ink">{sr ? "Nemaš pravo izmene rokova, pa se datumi dokumenata ne uvoze." : "You can't edit expiries, so document dates are not imported."}</p>
          )}

          {issueRows.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{sr ? "Proveri" : "Check"}</h4>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {issueRows.map((r) => (
                  <IssueRow key={`${r.sheet}-${r.row}`} r={r} sr={sr} />
                ))}
              </ul>
            </div>
          )}

          {ignored.length > 0 && (
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              {sr ? "Kolone koje nisam prepoznao (ne uvoze se): " : "Columns not recognised (not imported): "}
              {ignored.map((s) => `${sr ? SHEET_META[s.sheet].sr : SHEET_META[s.sheet].en}: ${s.ignored.join(", ")}`).join(" · ")}
            </p>
          )}

          {preview.rows.length > 0 && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowAll((x) => !x)} className="text-xs font-medium text-ink-2 hover:text-ink">
                {showAll ? (sr ? "Sakrij redove" : "Hide rows") : sr ? `Prikaži sve redove (${preview.rows.length})` : `Show all rows (${preview.rows.length})`}
              </button>
              {showAll && (
                <div className="mt-2 overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-line">
                      {preview.rows.map((r) => (
                        <tr key={`${r.sheet}-${r.row}`}>
                          <td className="w-24 px-3 py-1.5 text-ink-3">{sr ? SHEET_META[r.sheet].sr : SHEET_META[r.sheet].en}</td>
                          <td className="w-14 px-1 py-1.5 text-ink-3 tnum">{sr ? "red" : "row"} {r.row}</td>
                          <td className="px-2 py-1.5 font-medium text-ink">{r.label}</td>
                          <td className="px-2 py-1.5 text-ink-3 tnum">{r.docs ? `${r.docs} ${sr ? pl(r.docs, "rok", "roka", "rokova") : "dates"}` : ""}</td>
                          <td className="px-3 py-1.5 text-right">
                            <ActionBadge a={r.action} sr={sr} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3">
          <span className={cn("text-sm", error ? "text-bad" : "text-ink-3")}>
            {error ?? (errors > 0 ? (sr ? "Redovi sa greškom se preskaču." : "Rows with errors are skipped.") : sr ? "Ništa nije sačuvano dok ne klikneš Uvezi." : "Nothing is saved until you click Import.")}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>{sr ? "Otkaži" : "Cancel"}</Button>
            <Button variant="primary" disabled={!!busy || toImport === 0} onClick={commit}>
              {busy === "commit" ? (sr ? "Uvozim…" : "Importing…") : `${sr ? "Uvezi" : "Import"} ${toImport || ""}`.trim()}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── start: three steps ── */
  return (
    <div>
      <div className="max-h-[calc(94dvh-128px)] overflow-y-auto overscroll-contain px-4 py-5 sm:max-h-[65vh] sm:px-5">
        <ol className="grid gap-3">
          <Step n={1} title={sr ? "Preuzmi šablon" : "Download the template"}>
            <p>
              {sr
                ? "Excel sa listovima Kamioni, Prikolice i Vozači. Ako već imaš nešto u Roadline-u, biće upisano u fajl, pa samo dopuniš."
                : "An Excel file with Trucks, Trailers and Drivers sheets. Anything already in Roadline is in it, so you only fill the gaps."}
            </p>
            <a href={TEMPLATE_URL} download className={cn(btnClass("secondary"), "mt-2.5")}>
              <Download /> {sr ? "Preuzmi šablon (.xlsx)" : "Download template (.xlsx)"}
            </a>
          </Step>
          <Step n={2} title={sr ? "Popuni u Excelu" : "Fill it in"}>
            <p>
              {sr
                ? "Jedan red je jedan kamion, prikolica ili vozač. Za dokumenta (zelene kolone) upiši samo datum isteka. Obavezni su samo registracija, odnosno ime i prezime."
                : "One row is one truck, trailer or driver. For documents (green columns) write only the expiry date. Only the plate, or first and last name, is required."}
            </p>
          </Step>
          <Step n={3} title={sr ? "Ubaci popunjen fajl" : "Upload the filled file"}>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                drag ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2/50 hover:bg-surface-2",
              )}
            >
              {busy === "preview" ? (
                <span className="text-sm text-ink-2">{sr ? "Čitam fajl…" : "Reading the file…"}</span>
              ) : (
                <>
                  <Upload size={18} className="text-ink-3" />
                  <span className="text-sm font-medium text-ink">{sr ? "Izaberi fajl ili ga prevuci ovde" : "Choose a file or drop it here"}</span>
                  <span className="text-xs text-ink-3">{sr ? "Excel .xlsx, do 5 MB. Pre upisa vidiš šta će biti dodato." : "Excel .xlsx, up to 5 MB. You see what will be added before saving."}</span>
                </>
              )}
              {fileInput}
            </label>
            {error && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-bad-ink">
                <CircleAlert size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
          </Step>
        </ol>
      </div>
      <div className="flex justify-end border-t border-line bg-surface-2/60 px-4 py-3">
        <Button onClick={onClose}>{sr ? "Zatvori" : "Close"}</Button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold text-ink-2 tnum">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-ink-2">
        <h3 className="mb-0.5 font-medium text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function ActionBadge({ a, sr }: { a: PreviewRow["action"]; sr: boolean }) {
  if (a === "new") return <Badge tone="good">{sr ? "novo" : "new"}</Badge>;
  if (a === "update") return <Badge tone="accent">{sr ? "dopunjuje" : "update"}</Badge>;
  return <Badge tone="bad">{sr ? "greška" : "error"}</Badge>;
}

function IssueRow({ r, sr }: { r: PreviewRow; sr: boolean }) {
  const err = r.action === "error";
  return (
    <li className="flex gap-2.5 px-3 py-2.5 text-sm">
      {err ? <CircleAlert size={15} className="mt-0.5 shrink-0 text-bad" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-ink">{r.label}</span>
          <span className="text-xs text-ink-3">
            {sr ? SHEET_META[r.sheet].sr : SHEET_META[r.sheet].en}, {sr ? "red" : "row"} {r.row}
            {err && (sr ? " · preskače se" : " · skipped")}
          </span>
        </div>
        <ul className="mt-0.5 text-xs leading-relaxed text-ink-2">
          {r.issues.map((i, k) => (
            <li key={k} className={i.level === "error" ? "text-bad-ink" : undefined}>
              {i.text}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/** Settings: what the import is, with the two actions. */
export function FleetImportPanel() {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 pt-1 pb-4">
      <p className="text-sm leading-relaxed text-ink-2">
        {sr
          ? "Kamioni, prikolice i vozači sa rokovima dokumenata iz jednog Excel fajla. Preuzmi šablon, popuni ga i vrati. Šablon sadrži i ono što već imaš, pa njim možeš i da dopuniš podatke."
          : "Trucks, trailers and drivers with their document expiries from one Excel file. Download the template, fill it in and upload it. The template includes what you already have, so it can also fill in gaps."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={TEMPLATE_URL} download className={btnClass("secondary")}>
          <Download /> {sr ? "Preuzmi šablon" : "Download template"}
        </a>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Upload /> {sr ? "Ubaci popunjen fajl" : "Upload filled file"}
        </Button>
      </div>
      <FleetImportDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** Overview of a company with an empty fleet: the first step. */
export function FleetOnboarding() {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:gap-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-good-soft text-good">
          <FileSpreadsheet size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">{sr ? "Unesi flotu iz Excela" : "Bring your fleet in from Excel"}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            {sr
              ? "Preuzmi šablon, upiši kamione, prikolice i vozače sa datumima isteka dokumenata i vrati fajl. Za par minuta je sve unutra, a rokovi se odmah prate."
              : "Download the template, list your trucks, trailers and drivers with document expiry dates and upload it. A few minutes and everything is in, with expiries tracked right away."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={TEMPLATE_URL} download className={btnClass("secondary")}>
            <Download /> {sr ? "Šablon" : "Template"}
          </a>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Upload /> {sr ? "Ubaci fajl" : "Upload file"}
          </Button>
        </div>
      </div>
      <div className="border-t border-line bg-surface-2/50 px-5 py-2.5 text-xs text-ink-3">
        {sr ? "Možeš i ručno: " : "Or by hand: "}
        <Link href="/vehicles" className="font-medium text-ink-2 hover:text-ink">
          {sr ? "dodaj prvi kamion" : "add the first truck"}
        </Link>
      </div>
      <FleetImportDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
