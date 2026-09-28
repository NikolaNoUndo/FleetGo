"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileUp, Fuel, Store } from "lucide-react";
import { DataTable, type Column, type Filter } from "../data-table";
import { SupplierPicker, useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { Button, cn } from "../ui/primitives";
import { FieldShell, Modal, Segmented, TextArea } from "../ui/client";
import { AddButton, Stack } from "./common";
import { PLACE_COLORS } from "../map/place-colors";
import { importPlaces } from "@/app/actions";
import { parsePlacesFile, type ParsedPlaces } from "@/lib/place-import";
import type { Refs } from "@/lib/resources";
import type { MapPlace } from "@/lib/places";

export type PlaceRow = MapPlace & { coords: string };

function KindBadge({ kind }: { kind: MapPlace["kind"] }) {
  const { locale } = usePrefs();
  const Icon = kind === "pump" ? Fuel : Store;
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-2">
      <span className="flex size-5 items-center justify-center rounded-full text-white" style={{ background: PLACE_COLORS[kind] }}>
        <Icon size={11} strokeWidth={2} />
      </span>
      {kind === "pump" ? (locale === "sr" ? "Pumpa" : "Fuel station") : locale === "sr" ? "Prodavnica / servis" : "Shop / workshop"}
    </span>
  );
}

export function PlacesTable({ rows, refs }: { rows: PlaceRow[]; refs: Refs }) {
  const { t, locale } = usePrefs();
  const sr = locale === "sr";
  const crud = useCrud("places", refs);
  const [importing, setImporting] = useState(false);

  const cols: Column<PlaceRow>[] = [
    {
      key: "name",
      header: sr ? "Naziv" : "Name",
      sortValue: (r) => r.name,
      render: (r) => <Stack main={r.name} sub={r.supplierName && r.supplierName !== r.name ? r.supplierName : (r.note ?? undefined)} />,
    },
    { key: "kind", header: t("f.kind"), sortValue: (r) => r.kind, render: (r) => <KindBadge kind={r.kind} /> },
    { key: "address", header: t("f.address"), hide: "md", sortValue: (r) => r.address, render: (r) => <span className="text-ink-2">{r.address ?? "—"}</span> },
    {
      key: "coords",
      header: sr ? "Na mapi" : "On map",
      hide: "sm",
      render: (r) => (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-ink-2 tnum hover:text-accent"
        >
          {r.lat.toFixed(4)}, {r.lng.toFixed(4)} <ExternalLink size={12} />
        </a>
      ),
    },
  ];
  const filters: Filter<PlaceRow>[] = [
    { value: "all", label: t("c.all"), predicate: () => true },
    { value: "shop", label: sr ? "Prodavnice" : "Shops", predicate: (r) => r.kind === "shop" },
    { value: "pump", label: sr ? "Pumpe" : "Fuel", predicate: (r) => r.kind === "pump" },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        filters={filters}
        searchText={(r) => [r.name, r.supplierName, r.address, r.note].join(" ")}
        toolbar={
          crud.canEdit ? (
            <div className="flex gap-2">
              <Button onClick={() => setImporting(true)}>
                <FileUp /> {sr ? "Uvezi fajl" : "Import file"}
              </Button>
              <AddButton onClick={crud.create} />
            </div>
          ) : undefined
        }
        actions={crud.canEdit ? (r) => crud.menu(r) : undefined}
        initialSort={{ key: "name", dir: "asc" }}
      />
      {crud.node}
      <Modal open={importing} onClose={() => setImporting(false)} title={sr ? "Uvoz lokacija iz fajla" : "Import places from a file"} wide>
        {importing && <ImportForm refs={refs} onDone={() => setImporting(false)} />}
      </Modal>
    </>
  );
}

function ImportForm({ refs, onDone }: { refs: Refs; onDone: () => void }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const suppliers = refs.suppliers ?? [];
  const eurowag = suppliers.find((s) => s.label.toLowerCase() === "eurowag");
  const [kind, setKind] = useState<"pump" | "shop">("pump");
  const [supplier, setSupplier] = useState(eurowag ? eurowag.id : "new:Eurowag");
  const [replace, setReplace] = useState(true);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const parsed: ParsedPlaces | null = useMemo(() => (text.trim() ? parsePlacesFile(text) : null), [text]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      setMessage(sr ? "Fajl je veći od 15 MB." : "The file is larger than 15 MB.");
      return;
    }
    setMessage(null);
    setFileName(f.name);
    setText(await f.text());
  };

  const submit = () =>
    start(async () => {
      if (!parsed?.rows.length) return;
      // send in parts to stay well under the request size limit; only the first part replaces
      let sup = supplier;
      for (let i = 0; i < parsed.rows.length; i += 2000) {
        const res = await importPlaces({ kind, supplier: sup, replace: replace && i === 0, rows: parsed.rows.slice(i, i + 2000) });
        if (!res.ok) {
          setMessage(res.message);
          router.refresh();
          return;
        }
        if (res.supplierId) sup = res.supplierId; // a new supplier is created once, then reused
      }
      router.refresh();
      onDone();
    });

  const supplierLabel = supplier.startsWith("new:") ? supplier.slice(4) : (suppliers.find((s) => s.id === supplier)?.label ?? "");

  return (
    <div>
      <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
        <p className="text-sm leading-relaxed text-ink-2 sm:col-span-2">
          {sr
            ? "Podržani su CSV/TXT (sa zaglavljem ili Garmin POI: dužina, širina, naziv, opis), KML (Google Earth) i GPX. Kolone se prepoznaju same: naziv, adresa, grad, država, lat/lng."
            : "CSV/TXT (with a header, or Garmin POI: lon, lat, name, description), KML (Google Earth) and GPX are supported. Columns are detected automatically: name, address, city, country, lat/lng."}
        </p>
        <FieldShell label={sr ? "Vrsta" : "Type"}>
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            items={[
              { value: "pump", label: sr ? "Pumpe" : "Fuel stations" },
              { value: "shop", label: sr ? "Prodavnice / servisi" : "Shops / workshops" },
            ]}
          />
        </FieldShell>
        <FieldShell label={sr ? "Dobavljač / mreža" : "Supplier / network"} htmlFor="imp-supplier">
          <SupplierPicker id="imp-supplier" value={supplier} options={suppliers} onChange={setSupplier} />
        </FieldShell>
        <FieldShell label={sr ? "Fajl" : "File"} span={2} htmlFor="imp-file">
          <label
            htmlFor="imp-file"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2/50 px-3 py-3 text-sm text-ink-2 hover:bg-surface-2"
          >
            <FileUp size={16} className="text-ink-3" />
            <span className="min-w-0 flex-1 truncate">{fileName ?? (sr ? "Izaberi .csv, .txt, .kml ili .gpx fajl" : "Choose a .csv, .txt, .kml or .gpx file")}</span>
            <input id="imp-file" type="file" accept=".csv,.txt,.kml,.gpx,.xml,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </FieldShell>
        <FieldShell label={sr ? "…ili nalepi redove" : "…or paste rows"} span={2} htmlFor="imp-text">
          <TextArea
            id="imp-text"
            rows={4}
            value={fileName ? "" : text}
            disabled={!!fileName}
            onChange={(e) => setText(e.target.value)}
            placeholder={"naziv;adresa;lat;lng\nRapidex Novi Sad;Sentandrejski put 11;45.2671;19.8335"}
            className="font-mono text-xs"
          />
        </FieldShell>

        {parsed && (
          <div className="sm:col-span-2">
            <div className={cn("text-sm font-medium", parsed.rows.length ? "text-good-ink" : "text-bad-ink")}>
              {parsed.rows.length
                ? sr
                  ? `Pronađeno ${parsed.rows.length} lokacija${parsed.skipped ? `, ${parsed.skipped} redova bez naziva ili koordinata se preskače` : ""}.`
                  : `Found ${parsed.rows.length} places${parsed.skipped ? `, ${parsed.skipped} rows without a name or coordinates are skipped` : ""}.`
                : sr
                  ? "Nisam prepoznao nijednu lokaciju. Proveri da fajl ima naziv i koordinate."
                  : "No places recognised. Check that the file has names and coordinates."}
            </div>
            {parsed.rows.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-line">
                <table className="w-full text-xs">
                  <tbody>
                    {parsed.rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="px-2.5 py-1.5 font-medium">{r.name}</td>
                        <td className="px-2.5 py-1.5 text-ink-3">{r.address ?? ""}</td>
                        <td className="px-2.5 py-1.5 text-right text-ink-3 tnum whitespace-nowrap">
                          {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <label className="flex items-start gap-2.5 text-sm text-ink-2 sm:col-span-2">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            {sr
              ? `Zameni postojeće ${kind === "pump" ? "pumpe" : "prodavnice"}${supplierLabel ? ` dobavljača „${supplierLabel}“` : " bez dobavljača"} ovim spiskom (za ažuriranje liste).`
              : `Replace the existing ${kind === "pump" ? "fuel stations" : "shops"}${supplierLabel ? ` of “${supplierLabel}”` : " without a supplier"} with this list (to update it).`}
          </span>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3">
        <span className="text-sm text-bad">{message}</span>
        <div className="flex gap-2">
          <Button onClick={onDone}>{sr ? "Otkaži" : "Cancel"}</Button>
          <Button variant="primary" disabled={pending || !parsed?.rows.length} onClick={submit}>
            {pending ? (sr ? "Uvozim…" : "Importing…") : sr ? `Uvezi ${parsed?.rows.length ?? ""}`.trim() : `Import ${parsed?.rows.length ?? ""}`.trim()}
          </Button>
        </div>
      </div>
    </div>
  );
}
