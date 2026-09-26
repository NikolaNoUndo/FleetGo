"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlugZap, RefreshCw } from "lucide-react";
import { refreshRate, saveSettings, testTelematics } from "@/app/actions";
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

export function TelematicsTest() {
  const { t } = usePrefs();
  const [res, setRes] = useState<Awaited<ReturnType<typeof testTelematics>> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => start(async () => setRes(await testTelematics()))} disabled={pending}>
        <PlugZap />
        {t("s.test")}
      </Button>
      {res && (
        <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Badge tone={res.source === "wialon" ? "good" : "neutral"}>{t(res.source === "wialon" ? "l.source.wialon" : "l.source.simulation")}</Badge>
          <span className="tnum">
            {res.units} {t("s.units").toLowerCase()} · {res.matched} {t("s.matched")}
          </span>
          {res.error && <span className="text-bad-ink">{res.error}</span>}
        </span>
      )}
    </div>
  );
}
