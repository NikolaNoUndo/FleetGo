"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileUp, MapPin } from "lucide-react";
import { DataTable, type Column, type Filter } from "../data-table";
import { SupplierPicker, useCrud } from "../record-form";
import { usePrefs } from "../prefs";
import { Button, cn } from "../ui/primitives";
import { FieldShell, Modal, Segmented, Select, TextArea } from "../ui/client";
import { AddButton, Stack } from "./common";
import { KindDot } from "../map/map-overlay";
import { importPlaces } from "@/app/actions";
import { parsePlacesFile, type ParsedPlaces } from "@/lib/place-import";
import { geocodeRows, type GeoResult } from "@/lib/geocode-client";
import { relTime } from "@/lib/format";
import { PLACE_KINDS, PRICE_CURRENCIES, optLabel } from "@/lib/catalog";
import type { Refs } from "@/lib/resources";
import type { MapPlace, PlaceKind } from "@/lib/places";

/** `phone` is the place's own number (edited in the form); `displayPhone` falls back to the supplier's. */
export type PlaceRow = MapPlace & {
  coords: string;
  displayPhone: string | null;
};

function KindBadge({ kind }: { kind: PlaceKind }) {
  const { locale } = usePrefs();
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <KindDot kind={kind} size={20} />
      {optLabel(PLACE_KINDS, kind, locale)}
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
      render: (r) => (
        <Stack
          main={r.name}
          sub={
            r.supplierName && r.supplierName !== r.name
              ? r.supplierName
              : (r.note ?? undefined)
          }
        />
      ),
    },
    {
      key: "phone",
      header: t("f.phone"),
      hide: "lg",
      sortValue: (r) => r.displayPhone,
      render: (r) =>
        r.displayPhone ? (
          <a
            href={`tel:${r.displayPhone.replace(/\s/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="whitespace-nowrap text-ink-2 hover:text-accent"
          >
            {r.displayPhone}
          </a>
        ) : (
          <span className="text-ink-4">—</span>
        ),
    },
    {
      key: "kind",
      header: t("f.kind"),
      sortValue: (r) => r.kind,
      render: (r) => <KindBadge kind={r.kind} />,
    },
    {
      key: "price",
      header: sr ? "Dizel" : "Diesel",
      align: "right",
      sortValue: (r) => r.dieselPrice,
      render: (r) =>
        r.dieselPrice !== null ? (
          <span className="whitespace-nowrap">
            <span className="font-medium tnum">
              {r.dieselPrice.toLocaleString(sr ? "sr-Latn-RS" : "en-GB", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 3,
              })}{" "}
              {r.priceCurrency}
            </span>
            {r.priceUpdatedAt && (
              <span className="block text-xs text-ink-3">
                {relTime(new Date(r.priceUpdatedAt).getTime(), locale)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-4">—</span>
        ),
    },
    {
      key: "address",
      header: t("f.address"),
      hide: "md",
      sortValue: (r) => r.address,
      render: (r) => <span className="text-ink-2">{r.address ?? "—"}</span>,
    },
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
    {
      value: "shop",
      label: sr ? "Delovi" : "Parts",
      predicate: (r) => r.kind === "shop",
    },
    {
      value: "service",
      label: sr ? "Servisi" : "Workshops",
      predicate: (r) => r.kind === "service",
    },
    {
      value: "pump",
      label: sr ? "Pumpe" : "Fuel",
      predicate: (r) => r.kind === "pump",
    },
    {
      value: "company",
      label: sr ? "Firma" : "Company",
      predicate: (r) => r.kind === "hq" || r.kind === "parking",
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        filters={filters}
        searchText={(r) =>
          [r.name, r.supplierName, r.address, r.note].join(" ")
        }
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
      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        title={sr ? "Uvoz lokacija iz fajla" : "Import places from a file"}
        wide
      >
        {importing && (
          <ImportForm refs={refs} onDone={() => setImporting(false)} />
        )}
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
  const [kind, setKind] = useState<PlaceKind>("pump");
  const [supplier, setSupplier] = useState(
    eurowag ? eurowag.id : "new:Eurowag",
  );
  const [replace, setReplace] = useState(true);
  const [currency, setCurrency] = useState("EUR");
  const [done, setDone] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const parsed: ParsedPlaces | null = useMemo(
    () => (text.trim() ? parsePlacesFile(text) : null),
    [text],
  );
  // rows with only an address get coordinates in the browser (OpenStreetMap), on request
  const [geoState, setGeo] = useState<{ text: string; result: GeoResult } | null>(null);
  const [geoDone, setGeoDone] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const geo = geoState?.text === text ? geoState.result : null;
  const toGeocode = parsed?.toGeocode ?? [];
  const allRows = [...(parsed?.rows ?? []), ...(geo?.found ?? []).map(({ approx: _approx, ...r }) => r)];
  const findCoords = async () => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setGeoDone(0);
    try {
      const result = await geocodeRows(toGeocode, setGeoDone, ctl.signal);
      setGeo({ text, result });
    } catch {
      /* stopped */
    } finally {
      setGeoDone(null);
    }
  };
  const updates = kind === "pump" ? (parsed?.updates.length ?? 0) : 0;
  const pricedRows =
    kind === "pump"
      ? allRows.filter((r) => r.dieselPrice).length
      : 0;
  const total = allRows.length + updates;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      setMessage(
        sr ? "Fajl je veći od 15 MB." : "The file is larger than 15 MB.",
      );
      return;
    }
    setMessage(null);
    setFileName(f.name);
    setText(await f.text());
  };

  const submit = () =>
    start(async () => {
      if (!parsed || (!allRows.length && !parsed.updates.length)) return;
      // send in parts to stay well under the request size limit; only the first part replaces
      let sup = supplier;
      let added = 0;
      let updated = 0;
      const n = Math.max(allRows.length, parsed.updates.length);
      for (let i = 0; i < n; i += 2000) {
        const res = await importPlaces({
          kind,
          supplier: sup,
          currency,
          replace: replace && i === 0,
          rows: allRows.slice(i, i + 2000),
          updates: kind === "pump" ? parsed.updates.slice(i, i + 2000) : [],
        });
        if (!res.ok) {
          setMessage(res.message);
          router.refresh();
          return;
        }
        added += res.count;
        updated += res.updated;
        if (res.supplierId) sup = res.supplierId; // a new supplier is created once, then reused
      }
      router.refresh();
      if (!parsed.updates.length) return onDone();
      const missed = parsed.updates.length - updated;
      setDone(
        sr
          ? `${added ? `Uvezeno lokacija: ${added}. ` : ""}Ažurirane cene: ${updated}.${missed > 0 ? ` Bez pumpe istog naziva: ${missed}.` : ""}`
          : `${added ? `Imported ${added} places. ` : ""}Price updated for ${updated} stations.${missed > 0 ? ` ${missed} names did not match an existing station.` : ""}`,
      );
    });

  const supplierLabel = supplier.startsWith("new:")
    ? supplier.slice(4)
    : (suppliers.find((s) => s.id === supplier)?.label ?? "");

  return (
    <div>
      <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
        <p className="text-sm leading-relaxed text-ink-2 sm:col-span-2">
          {sr
            ? "Podržani su CSV/TXT (sa zaglavljem ili Garmin POI: dužina, širina, naziv, opis), KML (Google Earth) i GPX. Kolone se prepoznaju same: naziv, adresa, grad, država, lat/lng, a za pumpe i cena dizela, valuta i datum. Spisak cena bez koordinata ažurira postojeće pumpe istog naziva."
            : "CSV/TXT (with a header, or Garmin POI: lon, lat, name, description), KML (Google Earth) and GPX are supported. Columns are detected automatically: name, address, city, country, lat/lng, and for fuel stations the diesel price, currency and date. A price list without coordinates updates existing stations with the same name."}
        </p>
        <FieldShell label={sr ? "Vrsta" : "Type"}>
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            items={[
              { value: "pump", label: sr ? "Pumpe" : "Fuel stations" },
              { value: "shop", label: sr ? "Delovi" : "Parts" },
              { value: "service", label: sr ? "Servisi" : "Workshops" },
            ]}
          />
        </FieldShell>
        <FieldShell
          label={sr ? "Dobavljač / mreža" : "Supplier / network"}
          htmlFor="imp-supplier"
        >
          <SupplierPicker
            id="imp-supplier"
            value={supplier}
            options={suppliers}
            onChange={setSupplier}
          />
        </FieldShell>
        {kind === "pump" && (
          <FieldShell
            label={
              sr
                ? "Valuta cena (ako je nema u fajlu)"
                : "Price currency (if not in the file)"
            }
            htmlFor="imp-cur"
          >
            <Select
              id="imp-cur"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {PRICE_CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value}
                </option>
              ))}
            </Select>
          </FieldShell>
        )}
        <FieldShell label={sr ? "Fajl" : "File"} span={2} htmlFor="imp-file">
          <label
            htmlFor="imp-file"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2/50 px-3 py-3 text-sm text-ink-2 hover:bg-surface-2"
          >
            <FileUp size={16} className="text-ink-3" />
            <span className="min-w-0 flex-1 truncate">
              {fileName ??
                (sr
                  ? "Izaberi .csv, .txt, .kml ili .gpx fajl"
                  : "Choose a .csv, .txt, .kml or .gpx file")}
            </span>
            <input
              id="imp-file"
              type="file"
              accept=".csv,.txt,.kml,.gpx,.xml,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </FieldShell>
        <FieldShell
          label={sr ? "…ili nalepi redove" : "…or paste rows"}
          span={2}
          htmlFor="imp-text"
        >
          <TextArea
            id="imp-text"
            rows={4}
            value={fileName ? "" : text}
            disabled={!!fileName}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "naziv;adresa;lat;lng\nRapidex Novi Sad;Sentandrejski put 11;45.2671;19.8335"
            }
            className="font-mono text-xs"
          />
        </FieldShell>

        {toGeocode.length > 0 && (
          <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-sm sm:col-span-2">
            {geo ? (
              <span className={geo.missing.length ? "text-warn-ink" : "text-good-ink"}>
                {sr
                  ? `Po adresi pronađeno: ${geo.found.length}${geo.found.some((r) => r.approx) ? ` (${geo.found.filter((r) => r.approx).length} približno, po gradu)` : ""}${geo.missing.length ? `. Nije pronađeno: ${geo.missing.map((r) => r.name).join(", ")}` : ""}.`
                  : `Found by address: ${geo.found.length}${geo.found.some((r) => r.approx) ? ` (${geo.found.filter((r) => r.approx).length} approximate, by city)` : ""}${geo.missing.length ? `. Not found: ${geo.missing.map((r) => r.name).join(", ")}` : ""}.`}
              </span>
            ) : geoDone !== null ? (
              <span className="flex items-center justify-between gap-3">
                <span className="text-ink-2 tnum">
                  {sr ? "Tražim lokacije po adresi…" : "Looking up addresses…"} {geoDone}/{toGeocode.length}
                </span>
                <Button size="sm" onClick={() => abortRef.current?.abort()}>
                  {sr ? "Zaustavi" : "Stop"}
                </Button>
              </span>
            ) : (
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-ink-2">
                  {sr
                    ? `${toGeocode.length} redova ima adresu, ali ne i koordinate. Mogu da ih nađem na mapi (oko ${Math.ceil((toGeocode.length * 1.2) / 60)} min).`
                    : `${toGeocode.length} rows have an address but no coordinates. I can find them on the map (about ${Math.ceil((toGeocode.length * 1.2) / 60)} min).`}
                </span>
                <Button size="sm" variant="primary" onClick={findCoords}>
                  <MapPin /> {sr ? "Pronađi po adresi" : "Find by address"}
                </Button>
              </span>
            )}
          </div>
        )}

        {parsed && (
          <div className="sm:col-span-2">
            <div
              className={cn(
                "text-sm font-medium",
                total ? "text-good-ink" : "text-bad-ink",
              )}
            >
              {total
                ? sr
                  ? [
                      allRows.length
                        ? `Pronađeno ${allRows.length} lokacija${pricedRows ? ` (${pricedRows} sa cenom)` : ""}`
                        : "",
                      updates
                        ? `${updates} cena za postojeće pumpe (po nazivu)`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(", ") +
                    (parsed.skipped
                      ? `; ${parsed.skipped} redova se preskače`
                      : "") +
                    "."
                  : [
                      allRows.length
                        ? `Found ${allRows.length} places${pricedRows ? ` (${pricedRows} with a price)` : ""}`
                        : "",
                      updates
                        ? `${updates} prices for existing stations (by name)`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(", ") +
                    (parsed.skipped ? `; ${parsed.skipped} rows skipped` : "") +
                    "."
                : sr
                  ? "Nisam prepoznao nijednu lokaciju. Proveri da fajl ima naziv i koordinate (ili naziv i cenu)."
                  : "Nothing recognised. Check that the file has names and coordinates (or names and prices)."}
            </div>
            {total > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-line">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ...allRows.map((r) => ({ ...r, coords: true })),
                      ...parsed.updates.map((u) => ({
                        ...u,
                        address: null,
                        lat: 0,
                        lng: 0,
                        coords: false,
                      })),
                    ]
                      .slice(0, 5)
                      .map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-line last:border-0"
                        >
                          <td className="px-2.5 py-1.5 font-medium">
                            {r.name}
                          </td>
                          <td className="px-2.5 py-1.5 text-ink-3">
                            {r.address ?? ""}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tnum whitespace-nowrap">
                            {r.dieselPrice
                              ? `${r.dieselPrice} ${r.priceCurrency ?? currency}`
                              : ""}
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-ink-3 tnum whitespace-nowrap">
                            {r.coords
                              ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`
                              : sr
                                ? "samo cena"
                                : "price only"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(parsed?.rows.length ?? 0) > 0 && (
          <label className="flex items-start gap-2.5 text-sm text-ink-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              {sr
                ? `Zameni postojeće ${kind === "pump" ? "pumpe" : kind === "service" ? "servise" : "prodavnice delova"}${supplierLabel ? ` dobavljača „${supplierLabel}“` : " bez dobavljača"} ovim spiskom (za ažuriranje liste).`
                : `Replace the existing ${kind === "pump" ? "fuel stations" : kind === "service" ? "workshops" : "parts shops"}${supplierLabel ? ` of “${supplierLabel}”` : " without a supplier"} with this list (to update it).`}
            </span>
          </label>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3">
        {done ? (
          <span className="text-sm text-good-ink">{done}</span>
        ) : (
          <span className="text-sm text-bad">{message}</span>
        )}
        <div className="flex gap-2">
          {done ? (
            <Button variant="primary" onClick={onDone}>
              {sr ? "Gotovo" : "Done"}
            </Button>
          ) : (
            <>
              <Button onClick={onDone}>{sr ? "Otkaži" : "Cancel"}</Button>
              <Button
                variant="primary"
                disabled={pending || !total}
                onClick={submit}
              >
                {pending
                  ? sr
                    ? "Uvozim…"
                    : "Importing…"
                  : `${sr ? "Uvezi" : "Import"} ${total || ""}`.trim()}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
