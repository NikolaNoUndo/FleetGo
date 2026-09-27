"use client";

import Link from "@/components/ui/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LogOut } from "lucide-react";
import { login, logout, requestAccess, selectCompany, setPassword, type FormState } from "@/app/auth-actions";
import { adminLogin } from "@/app/admin/actions";
import { setPreference } from "@/app/actions";
import { usePrefs } from "./prefs";
import { Button, cn } from "./ui/primitives";
import { FieldShell, Segmented, TextArea, TextInput } from "./ui/client";
import { ROLES } from "@/lib/auth/permissions";

type L = { sr: string; en: string };
function useL() {
  const { locale } = usePrefs();
  return (x: L) => x[locale];
}

export function AuthLocaleSwitch() {
  const { locale } = usePrefs();
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <Segmented
      size="sm"
      value={locale}
      onChange={(v) =>
        start(async () => {
          await setPreference("locale", v);
          router.refresh();
        })
      }
      items={[
        { value: "sr", label: "SR" },
        { value: "en", label: "EN" },
      ]}
    />
  );
}

export function AuthCard({ title, sub, children, wide }: { title: ReactNode; sub?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("w-full rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8", wide ? "max-w-[560px]" : "max-w-[400px]")}>
      <h1 className="text-xl font-semibold tracking-[-0.015em]">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-ink-3">{sub}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ErrorNote({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-lg border border-bad-line bg-bad-soft px-3 py-2.5 text-sm text-bad-ink">{children}</div>;
}

function PasswordInput(props: React.ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={show ? "text" : "password"} className="pr-9" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-ink-3 hover:text-ink" aria-label={show ? "Hide" : "Show"}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

/* ------------------------------ Login ------------------------------ */
export function LoginForm() {
  const { locale } = usePrefs();
  const l = useL();
  const [state, action, pending] = useActionState<FormState, FormData>(login, null);
  return (
    <AuthCard title={l({ sr: "Prijava", en: "Sign in" })} sub={l({ sr: "Uđi u Roadline nalog svoje firme.", en: "Sign in to your company's Roadline account." })}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <ErrorNote>{state?.error}</ErrorNote>
        <FieldShell label="Email" htmlFor="email">
          <TextInput key={state?.fields?.email ?? ""} id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} autoFocus={!state?.fields?.email} />
        </FieldShell>
        <FieldShell label={l({ sr: "Lozinka", en: "Password" })} htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </FieldShell>
        <Button type="submit" variant="primary" className="h-9 w-full" disabled={pending}>
          {pending ? l({ sr: "Prijavljujem…", en: "Signing in…" }) : l({ sr: "Prijavi se", en: "Sign in" })}
        </Button>
      </form>
      <div className="mt-6 border-t border-line pt-5 text-sm text-ink-3">
        {l({ sr: "Firma još nema nalog?", en: "Company not on Roadline yet?" })}{" "}
        <Link href="/register" className="font-medium text-accent-ink hover:underline">
          {l({ sr: "Zatraži pristup", en: "Request access" })}
        </Link>
      </div>
      <p className="mt-3 text-xs text-ink-4">{l({ sr: "Zaboravljena lozinka? Javi se vlasniku firme ili administratoru.", en: "Forgot your password? Ask your company owner or the administrator." })}</p>
    </AuthCard>
  );
}

/* ------------------------------ Request access ------------------------------ */
export function RegisterForm() {
  const { locale } = usePrefs();
  const l = useL();
  const [state, action, pending] = useActionState<FormState, FormData>(requestAccess, null);
  if (state?.ok)
    return (
      <AuthCard title={l({ sr: "Zahtev je poslat", en: "Request sent" })}>
        <div className="flex gap-3 rounded-lg border border-good-line bg-good-soft p-4 text-sm text-good-ink">
          <CheckCircle2 className="mt-0.5 shrink-0" />
          <span>{l({ sr: "Hvala! Pregledaćemo zahtev i javiti ti se na email sa linkom za prijavu.", en: "Thanks! We'll review your request and email you a sign-in link." })}</span>
        </div>
        <Link href="/login" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
          {l({ sr: "Nazad na prijavu", en: "Back to sign in" })} <ArrowRight />
        </Link>
      </AuthCard>
    );
  const f = state?.fields ?? {};
  return (
    <AuthCard wide title={l({ sr: "Zatraži pristup", en: "Request access" })} sub={l({ sr: "Popuni podatke o firmi. Nalog odobravamo ručno i šaljemo link za prijavu.", en: "Tell us about your company. Accounts are approved manually." })}>
      <form key={JSON.stringify(f)} action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <div className="sm:col-span-2">
          <ErrorNote>{state?.error}</ErrorNote>
        </div>
        <FieldShell label={l({ sr: "Naziv firme *", en: "Company name *" })} span={2} htmlFor="companyName">
          <TextInput id="companyName" name="companyName" required defaultValue={f.companyName} />
        </FieldShell>
        <FieldShell label="PIB" htmlFor="pib">
          <TextInput id="pib" name="pib" inputMode="numeric" defaultValue={f.pib} />
        </FieldShell>
        <FieldShell label={l({ sr: "Broj vozila", en: "Fleet size" })} htmlFor="fleetSize">
          <TextInput id="fleetSize" name="fleetSize" inputMode="numeric" placeholder="npr. 12" defaultValue={f.fleetSize} />
        </FieldShell>
        <FieldShell label={l({ sr: "Ime i prezime *", en: "Your name *" })} htmlFor="contactName">
          <TextInput id="contactName" name="contactName" required defaultValue={f.contactName} />
        </FieldShell>
        <FieldShell label={l({ sr: "Telefon", en: "Phone" })} htmlFor="phone">
          <TextInput id="phone" name="phone" defaultValue={f.phone} />
        </FieldShell>
        <FieldShell label="Email *" span={2} htmlFor="email">
          <TextInput id="email" name="email" type="email" required defaultValue={f.email} />
        </FieldShell>
        <FieldShell label={l({ sr: "Napomena", en: "Message" })} span={2} htmlFor="message">
          <TextArea id="message" name="message" defaultValue={f.message} />
        </FieldShell>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <Link href="/login" className="text-sm text-ink-3 hover:text-ink">
            {l({ sr: "Već imaš nalog? Prijavi se", en: "Have an account? Sign in" })}
          </Link>
          <Button type="submit" variant="primary" className="h-9" disabled={pending}>
            {pending ? l({ sr: "Šaljem…", en: "Sending…" }) : l({ sr: "Pošalji zahtev", en: "Send request" })}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

/* ------------------------------ Set password ------------------------------ */
export function SetPasswordForm({ token, email, forced }: { token?: string; email?: string | null; forced?: boolean }) {
  const { locale } = usePrefs();
  const l = useL();
  const [state, action, pending] = useActionState<FormState, FormData>(setPassword, null);
  return (
    <AuthCard
      title={forced ? l({ sr: "Postavi novu lozinku", en: "Set a new password" }) : l({ sr: "Postavi lozinku", en: "Set your password" })}
      sub={
        forced
          ? l({ sr: "Prijavio si se privremenom lozinkom. Izaberi svoju pre nastavka.", en: "You signed in with a temporary password. Choose your own to continue." })
          : email
            ? `${l({ sr: "Nalog", en: "Account" })}: ${email}`
            : undefined
      }
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {token && <input type="hidden" name="token" value={token} />}
        <ErrorNote>{state?.error}</ErrorNote>
        <FieldShell label={l({ sr: "Nova lozinka (najmanje 8 znakova)", en: "New password (min. 8 characters)" })} htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} autoFocus />
        </FieldShell>
        <FieldShell label={l({ sr: "Ponovi lozinku", en: "Repeat password" })} htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required minLength={8} />
        </FieldShell>
        <Button type="submit" variant="primary" className="h-9 w-full" disabled={pending}>
          {pending ? l({ sr: "Čuvam…", en: "Saving…" }) : l({ sr: "Sačuvaj i uđi", en: "Save and continue" })}
        </Button>
      </form>
    </AuthCard>
  );
}

/* ------------------------------ Company picker ------------------------------ */
export function CompanyPicker({ companies, email }: { companies: { id: string; name: string; role: string }[]; email: string }) {
  const { locale } = usePrefs();
  const l = useL();
  const [pending, start] = useTransition();
  return (
    <AuthCard title={l({ sr: "Izaberi firmu", en: "Choose a company" })} sub={email}>
      {companies.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface-2 p-4 text-sm text-ink-2">
          {l({ sr: "Ovaj nalog trenutno nije član nijedne aktivne firme. Javi se vlasniku firme ili administratoru.", en: "This account is not a member of any active company yet." })}
        </p>
      ) : (
        <ul className="space-y-2">
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => selectCompany(c.id))}
                className="focus-ring flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-xs transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-surface-3 text-ink-2">
                  <Building2 />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-ink-3">{ROLES.find((r) => r.value === c.role)?.label[locale] ?? c.role}</span>
                </span>
                <ArrowRight className="text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form action={logout} className="mt-5">
        <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <LogOut /> {l({ sr: "Odjavi se", en: "Sign out" })}
        </button>
      </form>
    </AuthCard>
  );
}

/* ------------------------------ Admin login ------------------------------ */
export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, null);
  return (
    <AuthCard title="Admin" sub="Pristup samo za administratora platforme.">
      <form action={action} className="space-y-4">
        <ErrorNote>{state?.error}</ErrorNote>
        <FieldShell label="Korisničko ime" htmlFor="username">
          <TextInput key={state?.username ?? ""} id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus={!state?.username} defaultValue={state?.username} />
        </FieldShell>
        <FieldShell label="Lozinka" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </FieldShell>
        <Button type="submit" variant="dark" className="h-9 w-full" disabled={pending}>
          {pending ? "Prijavljujem…" : "Uđi u admin panel"}
        </Button>
      </form>
    </AuthCard>
  );
}
