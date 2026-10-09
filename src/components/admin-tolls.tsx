"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Square } from "lucide-react";
import { tollLoadTile, tollRampRefresh, tollReset } from "@/app/admin/actions";
import { HUF_PER_EUR, TOLL_COUNTRIES } from "@/lib/tolls/countries";
import { Badge, Button, cn, Progress } from "./ui/primitives";

export type NetRow = { code: string; ways: number; km: number; cells: number; tilesDone: number; tilesTotal: number; error: string | null; updatedAt: string | null };

const dt = (iso: string | null) => (iso ? new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—");
const nf = (n: number, d = 0) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: d, minimumFractionDigits: d });

/** "Putarina": the tolled road network from OpenStreetMap, and the rates used per country. */
export type RampRow = { key: string; country: string; name: string; stations: number; found: number; missing: string[]; fetchedAt: string | null; snapshot: string };

export function TollsTab({ network, ramps }: { network: NetRow[]; ramps: RampRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ code: string; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  async function loadCountry(code: string) {
    const r = await tollReset(code);
    if (!r.ok) throw new Error(r.error);
    setBusy({ code, done: 0, total: r.total });
    for (let i = 0; i < r.total; i++) {
      if (stop.current) return false;
      let res = await tollLoadTile(code, i);
      // Overpass is a free public service: wait and try a tile again before giving up
      for (let attempt = 1; !res.ok && attempt <= 2 && !stop.current; attempt++) {
        await new Promise((ok) => setTimeout(ok, 8000 * attempt));
        res = await tollLoadTile(code, i);
      }
      if (!res.ok) throw new Error(`${code}, deo ${i + 1}/${r.total}: ${res.error}`);
      setBusy({ code, done: res.done, total: res.total });
    }
    return true;
  }

  async function load(codes: string[]) {
    stop.current = false;
    setError(null);
    try {
      for (const c of codes) {
        const finished = await loadCountry(c);
        router.refresh();
        if (!finished) break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-line bg-surface shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Mreža puteva pod naplatom</h2>
            <p className="mt-0.5 text-xs text-ink-3">Iz OpenStreetMap-a (besplatno, Overpass API), po zemljama. Učitava se deo po deo; ostavi stranicu otvorenu dok traje.</p>
          </div>
          {busy ? (
            <Button size="sm" onClick={() => (stop.current = true)}>
              <Square /> Zaustavi
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => load(TOLL_COUNTRIES.map((c) => c.code))}>
              <Download /> Učitaj sve zemlje
            </Button>
          )}
        </header>
        {error && <p className="mx-4 mt-3 rounded-md bg-bad-soft px-3 py-2 text-xs text-bad-ink">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="h-9 pl-4 text-left font-medium">Zemlja</th>
                <th className="px-3 text-left font-medium">Mreža u OSM</th>
                <th className="px-3 text-right font-medium">Linija (km)</th>
                <th className="hidden px-3 text-right font-medium md:table-cell">Ćelija</th>
                <th className="hidden px-3 text-left font-medium md:table-cell">Učitano</th>
                <th className="pr-4 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {TOLL_COUNTRIES.map((c) => {
                const n = network.find((x) => x.code === c.code);
                const running = busy?.code === c.code;
                const complete = !!n && n.cells > 0 && n.tilesDone === n.tilesTotal;
                const low = complete && n.km < c.expectKm; // dual carriageways count twice, so a good load is well above this
                return (
                  <tr key={c.code} className="border-b border-line/60 last:border-0">
                    <td className="h-12 pl-4">
                      <span className="mr-2 rounded bg-surface-3 px-1 py-0.5 text-[11px] font-semibold text-ink-2">{c.code}</span>
                      {c.name.sr}
                    </td>
                    <td className="px-3">
                      {running ? (
                        <div className="flex items-center gap-2">
                          <Progress value={(busy.done / busy.total) * 100} className="w-28" />
                          <span className="text-xs text-ink-3 tnum">
                            {busy.done}/{busy.total}
                          </span>
                        </div>
                      ) : n?.error ? (
                        <Badge tone="bad">Greška</Badge>
                      ) : complete ? (
                        low ? <Badge tone="warn">Malo puteva, proveri</Badge> : <Badge tone="good">Učitano</Badge>
                      ) : n && n.tilesDone > 0 ? (
                        <Badge tone="warn">
                          Delimično {n.tilesDone}/{n.tilesTotal}
                        </Badge>
                      ) : (
                        <Badge>Nije učitano</Badge>
                      )}
                      {n?.error && !running && <div className="mt-1 max-w-[320px] truncate text-xs text-bad-ink" title={n.error}>{n.error}</div>}
                    </td>
                    <td className="px-3 text-right tnum">{n?.km ? nf(n.km) : "—"}</td>
                    <td className="hidden px-3 text-right text-ink-2 tnum md:table-cell">{n?.cells ? nf(n.cells) : "—"}</td>
                    <td className="hidden px-3 text-ink-2 tnum md:table-cell">{dt(n?.updatedAt ?? null)}</td>
                    <td className="pr-4 text-right">
                      <Button size="sm" disabled={!!busy} onClick={() => load([c.code])}>
                        {complete ? "Osveži" : "Učitaj"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line/70 px-4 py-3 text-xs leading-relaxed text-ink-3">
          Italija, Francuska i Španija: samo autoputevi označeni kao putevi pod naplatom. Srbija i Hrvatska: svi autoputevi osim onih označenih kao besplatni. Slovenija, Mađarska, Austrija, Nemačka, Češka, Slovačka i Poljska: svi autoputevi i brze ceste (kamioni plaćaju po km). Bugarska i Rumunija: i glavni državni putevi. Deonice sa posebnom cenom (Brenner, Tauern, poljske koncesije, rumunski autoputevi) učitavaju se posle zemlje. Dvosmerni autoput se u OSM broji kao dve linije, pa su km linija oko dva puta veći od dužine autoputa.
        </p>
      </section>

      <RampsSection ramps={ramps} />

      <section className="rounded-xl border border-line bg-surface shadow-xs">
        <header className="border-b border-line/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Cene po km (kamion, EURO VI)</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Sa PDV-om gde se plaća na putu. Menjaju se u kodu (src/lib/tolls/countries.ts) kad operateri promene cenovnik. Kurs HUF: {HUF_PER_EUR} za 1 €. Kosim slovima su naše procene.
          </p>
        </header>
        <div className="divide-y divide-line/70">
          {TOLL_COUNTRIES.map((c) => (
            <details key={c.code} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="w-36 font-medium text-ink">{c.name.sr}</span>
                {([2, 3, 4, 5] as const).map((b) => (
                  <span key={b} className={cn("tnum text-ink-2", c.rates[b].estimated && "italic text-ink-3")}>
                    <span className="text-xs text-ink-3 not-italic">{b === 5 ? "5+" : b} os. </span>
                    {nf(c.rates[b].perKm, c.currency === "EUR" ? 3 : 1)} {c.currency}
                  </span>
                ))}
                <span className="ml-auto text-xs text-ink-3">od {c.validFrom.split("-").reverse().join(".")}.</span>
              </summary>
              <div className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-ink-2">
                <p>{c.basis}</p>
                {c.zones?.map((z) => (
                  <p key={z.key}>
                    <span className="font-medium text-ink">{z.name.sr}:</span> {z.basis}
                  </p>
                ))}
                {c.vignette && <p>{c.vignette.basis}</p>}
                {c.caveats && <p className="text-warn-ink">{c.caveats}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {c.sources.map((s) => (
                    <a key={s} href={s} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                      <ExternalLink size={12} /> {new URL(s).hostname}
                    </a>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Countries that charge from ramp to ramp: the operator's official entry–exit price list and its stations on the map. */
function RampsSection({ ramps }: { ramps: RampRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const countries = [...new Set(ramps.map((r) => r.country))];
  const refresh = async (country: string) => {
    setBusy(country);
    setMsg(null);
    const r = await tollRampRefresh(country).catch((e: Error) => ({ ok: false as const, error: e.message }));
    setMsg(r.ok ? { ok: true, text: r.summary } : { ok: false, text: r.error });
    setBusy(null);
    router.refresh();
  };
  return (
    <section className="rounded-xl border border-line bg-surface shadow-xs">
      <header className="border-b border-line/70 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Naplata od rampe do rampe</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Srbija, Hrvatska, Francuska i Španija naplaćuju po ulaznoj i izlaznoj stanici, ne po km. Srbija: lokacije stanica su ugrađene u aplikaciju, a cenovnik se sam preuzima sa sajta Puteva Srbije pri računanju (jednom mesečno); ako sajt ne odgovara, koristi se zvanični cenovnik sačuvan u aplikaciji. Dugme ispod ga osvežava odmah. Hrvatska, Francuska i Španija se do tada računaju procenom po km.
        </p>
      </header>
      {msg && <p className={cn("mx-4 mt-3 rounded-md px-3 py-2 text-xs", msg.ok ? "bg-good-soft text-good-ink" : "bg-bad-soft text-bad-ink")}>{msg.text}</p>}
      <div className="divide-y divide-line/70">
        {countries.map((c) => (
          <div key={c} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">{TOLL_COUNTRIES.find((x) => x.code === c)?.name.sr}</span>
              <Button size="sm" disabled={!!busy} onClick={() => refresh(c)}>
                {busy === c ? "Učitavam…" : "Osveži cenovnik"}
              </Button>
            </div>
            {ramps
              .filter((r) => r.country === c)
              .map((r) => (
                <div key={r.key} className="text-xs leading-relaxed text-ink-2">
                  <span className="font-medium text-ink">{r.name}:</span>{" "}
                  {r.fetchedAt ? (
                    <>
                      cenovnik sa sajta od {dt(r.fetchedAt)}, lokacija poznata za {r.found}/{r.stations} stanica
                    </>
                  ) : (
                    <span className="text-ink-3">koristi se cenovnik sačuvan u aplikaciji ({r.snapshot.split("-").reverse().join(". ")}.), lokacija poznata za {r.found}/{r.stations} stanica</span>
                  )}
                  {r.missing.length > 0 && <span className="text-warn-ink"> (bez lokacije: {r.missing.join(", ")})</span>}
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
