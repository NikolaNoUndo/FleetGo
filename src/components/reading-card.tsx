"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, HardDriveDownload, RefreshCw } from "lucide-react";
import { markReading } from "@/app/actions";
import { READINGS, nextReading, type ReadingKind } from "@/lib/catalog";
import { todayISO } from "@/lib/format";
import { usePrefs } from "./prefs";
import { ExpiryBadge } from "./ui/client";
import { DateField } from "./ui/date-field";
import { Button, Kv, Shell, cn } from "./ui/primitives";

/**
 * The tachograph of a truck / the card of a driver: when it was last downloaded and
 * when the next one is due. "Obnovi" means it was downloaded today; "Drugi datum" for
 * a download done earlier.
 */
export function ReadingCard({ kind, id, last, canEdit }: { kind: ReadingKind; id: string; last: string | null; canEdit: boolean }) {
  const { locale, date } = usePrefs();
  const sr = locale === "sr";
  const r = READINGS[kind];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState("");
  const next = nextReading(last, kind);
  const today = todayISO();

  const save = (value?: string) =>
    start(async () => {
      setError(null);
      const res = await markReading(kind, id, value);
      if (!res.ok) return setError(res.message);
      setPicking(false);
      router.refresh();
    });

  return (
    <Shell
      icon={kind === "card_download" ? <CreditCard /> : <HardDriveDownload />}
      title={r.label[locale]}
      action={<span className="text-xs text-ink-3">{r.every[locale]}</span>}
    >
      <div className="divide-y divide-line/70 px-4">
        <Kv label={sr ? "Poslednje" : "Last"}>{last ? date(last) : <span className="font-normal text-ink-3">{sr ? "Nije zabeleženo" : "Not recorded"}</span>}</Kv>
        <Kv label={sr ? "Sledeće" : "Next"}>
          {next ? (
            <span className="inline-flex items-center gap-2">
              {date(next)}
              <ExpiryBadge date={next} docType={kind} compact />
            </span>
          ) : (
            "—"
          )}
        </Kv>
      </div>
      {canEdit && (
        <div className="border-t border-line/70 px-4 py-3">
          {picking ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-ink-2">{sr ? "Kada je očitano?" : "When was it downloaded?"}</span>
              <DateField value={picked} onChange={setPicked} />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setPicking(false)}>
                  {sr ? "Otkaži" : "Cancel"}
                </Button>
                <Button size="sm" variant="primary" disabled={pending || !picked || picked > today} onClick={() => save(picked)}>
                  {sr ? "Sačuvaj" : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="primary" className="flex-1" disabled={pending || last === today} onClick={() => save()} title={sr ? "Očitano danas; sledeće se računa od danas" : "Downloaded today; the next one counts from today"}>
                <RefreshCw className={cn(pending && "animate-spin")} /> {last === today ? (sr ? "Očitano danas" : "Downloaded today") : sr ? "Obnovi" : "Renew"}
              </Button>
              <Button
                onClick={() => {
                  setPicked(last ?? today);
                  setPicking(true);
                }}
                title={sr ? "Očitano nekog drugog dana" : "Downloaded on another day"}
              >
                <CalendarDays /> {sr ? "Drugi datum" : "Other date"}
              </Button>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        </div>
      )}
    </Shell>
  );
}
