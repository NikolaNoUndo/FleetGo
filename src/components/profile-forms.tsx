"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Monitor, Smartphone } from "lucide-react";
import { changePassword, signOutOthers, signOutSession, type ProfileResult } from "@/app/(app)/profile/actions";
import { usePrefs } from "./prefs";
import { Badge, Button } from "./ui/primitives";
import { FieldShell, TextInput } from "./ui/client";

export function PasswordForm({ disabled }: { disabled: boolean }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const msg = (e: Exclude<ProfileResult, { ok: true }>["error"]) =>
    ({
      session: sr ? "Sesija je istekla, prijavi se ponovo." : "Session expired, sign in again.",
      admin: sr ? "Lozinka se ne može menjati iz admin pregleda." : "Password can't be changed from the admin view.",
      current: sr ? "Trenutna lozinka nije tačna." : "Current password is wrong.",
      short: sr ? "Nova lozinka mora imati najmanje 8 znakova." : "New password must be at least 8 characters.",
      match: sr ? "Nove lozinke se ne poklapaju." : "New passwords do not match.",
      same: sr ? "Nova lozinka mora biti drugačija od trenutne." : "New password must differ from the current one.",
      limit: sr ? "Previše pokušaja. Pokušaj ponovo za 15 minuta." : "Too many attempts. Try again in 15 minutes.",
    })[e];

  if (disabled) return <p className="text-sm text-ink-3">{sr ? "Nije dostupno u admin pregledu." : "Not available in the admin view."}</p>;
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(false);
        start(async () => {
          const r = await changePassword(v);
          if (!r.ok) return setError(msg(r.error));
          setError(null);
          setDone(true);
          setV({ current: "", next: "", confirm: "" });
        });
      }}
    >
      <FieldShell label={sr ? "Trenutna lozinka" : "Current password"} htmlFor="p-current" span={2}>
        <TextInput id="p-current" type="password" autoComplete="current-password" required value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} className="sm:max-w-[calc(50%-8px)]" />
      </FieldShell>
      <FieldShell label={sr ? "Nova lozinka" : "New password"} htmlFor="p-next">
        <TextInput id="p-next" type="password" autoComplete="new-password" required minLength={8} value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
      </FieldShell>
      <FieldShell label={sr ? "Ponovi novu lozinku" : "Repeat new password"} htmlFor="p-confirm">
        <TextInput id="p-confirm" type="password" autoComplete="new-password" required minLength={8} value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
      </FieldShell>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? (sr ? "Čuvam…" : "Saving…") : sr ? "Promeni lozinku" : "Change password"}
        </Button>
        {done && (
          <span className="inline-flex items-center gap-1.5 text-sm text-good-ink">
            <CheckCircle2 /> {sr ? "Lozinka je promenjena. Ostali uređaji su odjavljeni." : "Password changed. Other devices were signed out."}
          </span>
        )}
        {error && <span className="text-sm text-bad-ink">{error}</span>}
      </div>
    </form>
  );
}

type S = { id: string; browser: string; os: string; mobile: boolean; current: boolean; admin: boolean; when: string };

export function SessionsList({ sessions, disabled }: { sessions: S[]; disabled: boolean }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const [pending, start] = useTransition();
  const others = sessions.filter((s) => !s.current).length;
  return (
    <div>
      <ul className="divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-5 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">{s.mobile ? <Smartphone size={16} /> : <Monitor size={16} />}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {s.browser}
                {s.os && <span className="font-normal text-ink-3">· {s.os}</span>}
                {s.current && <Badge tone="good">{sr ? "Ovaj uređaj" : "This device"}</Badge>}
                {s.admin && <Badge tone="warn">{sr ? "Admin pregled" : "Admin view"}</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-ink-3">{s.when}</div>
            </div>
            {!s.current && !disabled && (
              <Button size="sm" disabled={pending} onClick={() => start(async () => { await signOutSession(s.id); router.refresh(); })}>
                {sr ? "Odjavi" : "Sign out"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 && !disabled && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3">
          <span className="text-xs text-ink-3">{sr ? "Ne prepoznaješ neku prijavu? Odjavi je i promeni lozinku." : "Don't recognise a session? Sign it out and change your password."}</span>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { await signOutOthers(); router.refresh(); })}>
            {sr ? "Odjavi sve ostale uređaje" : "Sign out all other devices"}
          </Button>
        </div>
      )}
    </div>
  );
}
