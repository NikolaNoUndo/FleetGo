"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlugZap, RefreshCw } from "lucide-react";
import { refreshRate, saveSettings, saveTelematics, testTelematics } from "@/app/actions";
import { usePrefs } from "./prefs";
import { Badge, Button, cn } from "./ui/primitives";
import { FieldShell, Segmented, TextInput } from "./ui/client";

type Nbs = { rate: number; day: string | null; source: string; stale: boolean };

export function CompanyForm({
  initial,
  nbs: initialNbs,
  readOnly,
}: {
  initial: { name: string; pib: string; address: string; eurRsdRate: string; warnDays: string; rateMode: string };
  nbs: Nbs;
  readOnly?: boolean;
}) {
  const { t, locale, date } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [nbs, setNbs] = useState(initialNbs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setV({ ...v, [k]: e.target.value });
  };
  const err = (k: string) => (errors[k] ? (errors[k] === "required" ? t("c.required") : t("err.number")) : undefined);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings(v);
          if (res.ok) {
            setErrors({});
            setSaved(true);
            router.refresh();
          } else setErrors(res.errors);
        });
      }}
    >
      <fieldset disabled={readOnly} className="grid gap-5 px-5 py-5 sm:grid-cols-2">
        <FieldShell label={t("s.companyName")} error={err("name")} span={2} htmlFor="s-name">
          <TextInput id="s-name" value={v.name} onChange={set("name")} />
        </FieldShell>
        <FieldShell label={t("s.pib")} htmlFor="s-pib">
          <TextInput id="s-pib" value={v.pib} onChange={set("pib")} />
        </FieldShell>
        <FieldShell label={t("s.address")} htmlFor="s-addr">
          <TextInput id="s-addr" value={v.address} onChange={set("address")} />
        </FieldShell>

        <div className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-4 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">{t("s.rate")}</span>
            <Segmented
              size="sm"
              value={v.rateMode}
              onChange={(m) => setV({ ...v, rateMode: m })}
              items={[
                { value: "nbs", label: sr ? "NBS, automatski" : "NBS, automatic" },
                { value: "manual", label: sr ? "Ručno" : "Manual" },
              ]}
            />
          </div>
          {v.rateMode === "nbs" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-xl font-semibold tnum">{nbs.rate.toFixed(4)}</span>
              <span className={cn("text-xs", nbs.stale ? "text-warn-ink" : "text-ink-3")}>
                {nbs.source === "fallback"
                  ? sr
                    ? "NBS kurs još nije preuzet, koristi se približna vrednost"
                    : "NBS rate not fetched yet, using an approximate value"
                  : `${sr ? "Srednji kurs NBS" : "NBS middle rate"} · ${date(nbs.day)}${nbs.stale ? (sr ? " · poslednji dostupan" : " · last available") : ""}`}
              </span>
              <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => startRefresh(async () => setNbs(await refreshRate()))}>
                <RefreshCw className={refreshing ? "animate-spin" : ""} /> {sr ? "Osveži" : "Refresh"}
              </Button>
            </div>
          ) : (
            <FieldShell label={sr ? "Kurs 1 EUR u RSD" : "1 EUR in RSD"} error={err("eurRsdRate")} htmlFor="s-rate">
              <TextInput id="s-rate" inputMode="decimal" className="tnum sm:max-w-[200px]" value={v.eurRsdRate} onChange={set("eurRsdRate")} />
            </FieldShell>
          )}
          <p className="text-xs leading-relaxed text-ink-3">{t("s.rateHint")}</p>
        </div>

        <FieldShell label={t("s.warnDays")} error={err("warnDays")} htmlFor="s-warn">
          <TextInput id="s-warn" inputMode="numeric" className="tnum" value={v.warnDays} onChange={set("warnDays")} />
        </FieldShell>
      </fieldset>
      {!readOnly && (
        <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3.5">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-good-ink">
              <CheckCircle2 />
              {t("s.saved")}
            </span>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? t("c.saving") : t("c.save")}
          </Button>
        </div>
      )}
    </form>
  );
}

/** Wialon connection for this company: token + optional Wialon Local host, plus a live test. */
export function TelematicsSettings({ hasToken, hint, host, canEdit }: { hasToken: boolean; hint: string | null; host: string | null; canEdit: boolean }) {
  const { t, locale } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const [token, setToken] = useState("");
  const [h, setH] = useState(host ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [res, setRes] = useState<Awaited<ReturnType<typeof testTelematics>> | null>(null);
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();

  const test = () => startTest(async () => setRes(await testTelematics()));
  const save = (remove = false) =>
    start(async () => {
      setError(null);
      setSaved(false);
      setRes(null);
      const r = await saveTelematics(remove ? { remove: true } : { token, host: h });
      if (!r.ok) {
        setError(
          r.error === "host"
            ? sr ? "Adresa servera mora biti javna https adresa, npr. https://wialon.mojafirma.rs" : "Server must be a public https address, e.g. https://wialon.example.com"
            : sr ? "Token nije ispravan. Kopiraj ceo token iz Wialona (samo slova i brojevi)." : "Invalid token. Copy the whole token from Wialon (letters and digits only).",
        );
        return;
      }
      setToken("");
      if (remove) setH("");
      setSaved(true);
      router.refresh();
      if (!remove) setRes(await testTelematics());
    });

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-2">
        {sr
          ? "Svaka firma upisuje svoj Wialon token. Pravi se u Wialonu (Podešavanja korisnika → Tokeni, ili ga izda GPS provajder) i daje pristup čitanju pozicija. Vozila se povezuju automatski po registarskoj oznaci u nazivu jedinice, ili preko polja „Wialon ID jedinice“ na vozilu."
          : "Each company enters its own Wialon token. Create it in Wialon (User settings → Tokens, or ask your GPS provider); it grants read access to positions. Vehicles link automatically by plate number in the unit name, or through the “Wialon unit ID” field."}
      </p>
      {canEdit ? (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <FieldShell label={sr ? "Wialon token" : "Wialon token"} htmlFor="w-token" span={2}>
            <TextInput
              id="w-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={hasToken ? (sr ? `Sačuvan (…${hint}). Upiši novi da ga zameniš.` : `Saved (…${hint}). Type a new one to replace it.`) : sr ? "Nalepi token ili celu adresu sa Wialon stranice (…access_token=…)" : "Paste the token or the whole Wialon page address (…access_token=…)"}
            />
          </FieldShell>
          <FieldShell label={sr ? "Wialon Local server (opciono)" : "Wialon Local server (optional)"} htmlFor="w-host" span={2}>
            <TextInput id="w-host" value={h} onChange={(e) => setH(e.target.value)} placeholder={sr ? "Prazno = Wialon Hosting" : "Empty = Wialon Hosting"} />
          </FieldShell>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending || (!token.trim() && !hasToken)}>
              {pending ? (sr ? "Čuvam…" : "Saving…") : sr ? "Sačuvaj i poveži" : "Save and connect"}
            </Button>
            {hasToken && (
              <>
                <Button type="button" onClick={test} disabled={testing || pending}>
                  <PlugZap /> {t("s.test")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => save(true)} disabled={pending}>
                  {sr ? "Ukloni token" : "Remove token"}
                </Button>
              </>
            )}
            {saved && !error && (
              <span className="inline-flex items-center gap-1 text-sm text-good-ink">
                <CheckCircle2 /> {sr ? "Sačuvano" : "Saved"}
              </span>
            )}
          </div>
          {error && <p className="text-sm text-bad-ink sm:col-span-2">{error}</p>}
        </form>
      ) : (
        hasToken && (
          <Button onClick={test} disabled={testing}>
            <PlugZap /> {t("s.test")}
          </Button>
        )
      )}
      {res && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Badge tone={res.source === "wialon" ? "good" : res.source === "error" ? "bad" : "neutral"}>
            {res.source === "wialon" ? (sr ? "Povezano" : "Connected") : res.source === "error" ? (sr ? "Wialon ne odgovara" : "Wialon error") : sr ? "Nije povezano" : "Not connected"}
          </Badge>
          {res.source === "wialon" && (
            <span className="tnum">
              {res.units} {t("s.units").toLowerCase()} · {res.matched} {t("s.matched")}
            </span>
          )}
          {res.error && <span className="text-bad-ink">{res.error}</span>}
        </div>
      )}
      {res && res.unmatched.length > 0 && (
        <div className="rounded-lg border border-line">
          <div className="border-b border-line px-3 py-2 text-xs font-medium text-ink-2">
            {sr
              ? "Jedinice koje nisu povezane sa vozilom – upiši njihov ID ili IMEI u polje „Wialon ID / IMEI“ na vozilu:"
              : "Units not linked to a vehicle – enter their ID or IMEI in the vehicle's “Wialon ID / IMEI” field:"}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="px-3 py-1.5 font-medium">{sr ? "Naziv u Wialonu" : "Name in Wialon"}</th>
                <th className="px-3 py-1.5 font-medium">Wialon ID</th>
                <th className="px-3 py-1.5 font-medium">IMEI / Unique ID</th>
              </tr>
            </thead>
            <tbody>
              {res.unmatched.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-3 py-1.5">{u.name}</td>
                  <td className="px-3 py-1.5 font-mono text-xs tnum">{u.id}</td>
                  <td className="px-3 py-1.5 font-mono text-xs tnum">{u.uid || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
