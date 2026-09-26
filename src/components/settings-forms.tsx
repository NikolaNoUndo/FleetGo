"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlugZap } from "lucide-react";
import { saveSettings, testTelematics } from "@/app/actions";
import { usePrefs } from "./prefs";
import { Badge, Button } from "./ui/primitives";
import { FieldShell, TextInput } from "./ui/client";

export function CompanyForm({ initial }: { initial: { name: string; pib: string; address: string; eurRsdRate: string; warnDays: string } }) {
  const { t } = usePrefs();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
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
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <FieldShell label={t("s.companyName")} error={err("name")} span={2} htmlFor="s-name">
          <TextInput id="s-name" value={v.name} onChange={set("name")} />
        </FieldShell>
        <FieldShell label={t("s.pib")} htmlFor="s-pib">
          <TextInput id="s-pib" value={v.pib} onChange={set("pib")} />
        </FieldShell>
        <FieldShell label={t("s.address")} htmlFor="s-addr">
          <TextInput id="s-addr" value={v.address} onChange={set("address")} />
        </FieldShell>
        <FieldShell label={t("s.rate")} error={err("eurRsdRate")} htmlFor="s-rate">
          <TextInput id="s-rate" inputMode="decimal" className="tnum" value={v.eurRsdRate} onChange={set("eurRsdRate")} />
        </FieldShell>
        <FieldShell label={t("s.warnDays")} error={err("warnDays")} htmlFor="s-warn">
          <TextInput id="s-warn" inputMode="numeric" className="tnum" value={v.warnDays} onChange={set("warnDays")} />
        </FieldShell>
        <p className="text-[12.5px] leading-relaxed text-ink-3 sm:col-span-2">{t("s.rateHint")}</p>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3.5">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-good">
            <CheckCircle2 size={15} />
            {t("s.saved")}
          </span>
        )}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t("c.saving") : t("c.save")}
        </Button>
      </div>
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
        <PlugZap size={15} />
        {t("s.test")}
      </Button>
      {res && (
        <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          <Badge tone={res.source === "wialon" ? "good" : "neutral"}>{t(res.source === "wialon" ? "l.source.wialon" : "l.source.simulation")}</Badge>
          <span className="tnum">
            {res.units} {t("s.units").toLowerCase()} · {res.matched} {t("s.matched")}
          </span>
          {res.error && <span className="text-bad">{res.error}</span>}
        </span>
      )}
    </div>
  );
}
