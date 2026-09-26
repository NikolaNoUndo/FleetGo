"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Building2, Check, CheckCircle2, Copy, Eye, KeyRound, Link2, Plus, RotateCcw, UserPlus, X } from "lucide-react";
import {
  addCompanyMember,
  adminPasswordLink,
  adminTempPassword,
  approveRequest,
  createCompany,
  impersonate,
  rejectRequest,
  setCompanyStatus,
  setUserStatus,
  type AdminResult,
} from "@/app/admin/actions";
import { DataTable, type Column } from "./data-table";
import { Badge, Button, Dot, PageHeader, StatusDot } from "./ui/primitives";
import { FieldShell, Modal, Select, TextInput, UnderlineTabs } from "./ui/client";
import { Stat, StatRow } from "./stat";
import { Stack } from "./tables/common";
import { ROLES } from "@/lib/auth/permissions";

type Req = {
  id: string;
  companyName: string;
  pib: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  fleetSize: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  handledAt: string | null;
};
type Company = { id: string; name: string; pib: string | null; status: string; createdAt: string; vehicles: number; members: { id: string; userId: string; email: string; role: string }[] };
type User = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  hasPassword: boolean;
  mustChange: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: { companyId: string; company: string; role: string }[];
};
type Log = { id: string; actor: string; action: string; company: string | null; details: unknown; createdAt: string };

/** Turns a failed server call into a readable message instead of failing silently. */
const failMsg = (e: unknown) =>
  e instanceof Error && /admin only/i.test(e.message)
    ? "Admin sesija je istekla. Osveži stranicu i prijavi se ponovo."
    : "Server nije odgovorio. Osveži stranicu (Ctrl+Shift+R) i pokušaj ponovo.";

const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label.sr ?? r;
const dt = (iso: string | null) => (iso ? new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—");

/** Shows a one-time link or temporary password with a copy button. */
function SecretModal({ secret, onClose }: { secret: { kind: "link" | "password"; value: string; who?: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const full = secret?.kind === "link" && typeof window !== "undefined" ? window.location.origin + secret.value : (secret?.value ?? "");
  return (
    <Modal open={!!secret} onClose={onClose} title={secret?.kind === "link" ? "Link za postavljanje lozinke" : "Privremena lozinka"}>
      <div className="space-y-3 px-5 py-5">
        <p className="text-sm text-ink-2">
          {secret?.kind === "link"
            ? `Pošalji ovaj link ${secret?.who ?? "korisniku"} (važi 7 dana, može se iskoristiti jednom).`
            : `Pošalji ovu lozinku ${secret?.who ?? "korisniku"}. Pri prvoj prijavi mora da je promeni. Ovde se prikazuje samo jednom.`}
        </p>
        <div className="flex gap-2">
          <TextInput readOnly value={full} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(full);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Kopirano" : "Kopiraj"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AdminPanel({ tab, activeWeek, requests, companies, users, log }: { tab: string; activeWeek: number; requests: Req[]; companies: Company[]; users: User[]; log: Log[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState<{ kind: "link" | "password"; value: string; who?: string } | null>(null);
  const [newCompany, setNewCompany] = useState(false);
  const [addMemberTo, setAddMemberTo] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<AdminResult>, who?: string) =>
    start(async () => {
      setError(null);
      const r = await fn().catch((e: unknown) => ({ ok: false as const, error: failMsg(e) }));
      if (!r.ok) setError(r.error);
      else if (r.link) setSecret({ kind: "link", value: r.link, who });
      else if (r.password) setSecret({ kind: "password", value: r.password, who });
      router.refresh();
    });

  const pendingReqs = requests.filter((r) => r.status === "pending");

  const reqCols: Column<Req>[] = [
    { key: "company", header: "Firma", sortValue: (r) => r.companyName, render: (r) => <Stack main={r.companyName} sub={[r.pib && `PIB ${r.pib}`, r.fleetSize && `${r.fleetSize} vozila`].filter(Boolean).join(" · ")} /> },
    { key: "contact", header: "Kontakt", sortValue: (r) => r.contactName, render: (r) => <Stack main={r.contactName} sub={[r.email, r.phone].filter(Boolean).join(" · ")} /> },
    { key: "msg", header: "Napomena", hide: "lg", render: (r) => <span className="block max-w-[260px] truncate text-ink-3">{r.message ?? "—"}</span> },
    { key: "date", header: "Stiglo", sortValue: (r) => r.createdAt, render: (r) => <span className="text-ink-2 tnum">{dt(r.createdAt)}</span> },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) =>
        r.status === "pending" ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => approveRequest(r.id), r.email)}>
              <Check /> Odobri
            </Button>
            <Button size="sm" disabled={pending} onClick={() => run(() => rejectRequest(r.id))}>
              <X /> Odbij
            </Button>
          </div>
        ) : (
          <StatusDot tone={r.status === "approved" ? "good" : "neutral"}>{r.status === "approved" ? "Odobreno" : "Odbijeno"}</StatusDot>
        ),
    },
  ];

  const companyCols: Column<Company>[] = [
    { key: "name", header: "Firma", sortValue: (c) => c.name, render: (c) => <Stack main={c.name} sub={c.pib ? `PIB ${c.pib}` : undefined} /> },
    {
      key: "owners",
      header: "Vlasnik",
      render: (c) => {
        const owners = c.members.filter((m) => m.role === "owner");
        return owners.length ? <span className="text-ink-2">{owners.map((o) => o.email).join(", ")}</span> : <Badge tone="warn">Nema vlasnika</Badge>;
      },
    },
    { key: "members", header: "Članovi", align: "right", sortValue: (c) => c.members.length, render: (c) => <span className="tnum">{c.members.length}</span> },
    { key: "vehicles", header: "Vozila", align: "right", sortValue: (c) => c.vehicles, render: (c) => <span className="tnum">{c.vehicles}</span> },
    { key: "created", header: "Kreirana", hide: "md", sortValue: (c) => c.createdAt, render: (c) => <span className="text-ink-3 tnum">{dt(c.createdAt)}</span> },
    { key: "status", header: "Status", sortValue: (c) => c.status, render: (c) => <StatusDot tone={c.status === "active" ? "good" : "bad"}>{c.status === "active" ? "Aktivna" : "Blokirana"}</StatusDot> },
  ];

  const userCols: Column<User>[] = [
    { key: "email", header: "Korisnik", sortValue: (u) => u.email, render: (u) => <Stack main={u.email} sub={u.name ?? undefined} dot={u.status === "active" ? "good" : "bad"} /> },
    {
      key: "companies",
      header: "Firme i uloge",
      render: (u) =>
        u.memberships.length ? (
          <span className="text-ink-2">{u.memberships.map((m) => `${m.company} (${roleLabel(m.role).toLowerCase()})`).join(", ")}</span>
        ) : (
          <span className="text-ink-4">—</span>
        ),
    },
    {
      key: "pw",
      header: "Lozinka",
      sortValue: (u) => Number(u.hasPassword),
      render: (u) => (!u.hasPassword ? <Badge tone="warn">Nije postavljena</Badge> : u.mustChange ? <Badge tone="accent">Privremena</Badge> : <Badge tone="good">Postavljena</Badge>),
    },
    { key: "last", header: "Poslednja prijava", hide: "md", sortValue: (u) => u.lastLoginAt ?? "", render: (u) => <span className="text-ink-2 tnum">{dt(u.lastLoginAt)}</span> },
  ];

  const logCols: Column<Log>[] = [
    { key: "at", header: "Vreme", sortValue: (l) => l.createdAt, render: (l) => <span className="text-ink-2 tnum">{dt(l.createdAt)}</span> },
    { key: "actor", header: "Ko", sortValue: (l) => l.actor, render: (l) => <span className="font-medium">{l.actor}</span> },
    { key: "action", header: "Radnja", sortValue: (l) => l.action, render: (l) => <code className="rounded bg-surface-3 px-1.5 py-0.5 text-xs">{l.action}</code> },
    { key: "company", header: "Firma", sortValue: (l) => l.company ?? "", render: (l) => <span className="text-ink-2">{l.company ?? "—"}</span> },
    { key: "details", header: "Detalji", hide: "lg", render: (l) => <span className="block max-w-[320px] truncate font-mono text-xs text-ink-3">{l.details ? JSON.stringify(l.details) : ""}</span> },
  ];

  const tabs = [
    { value: "requests", label: "Zahtevi", count: pendingReqs.length, href: "/admin?tab=requests" },
    { value: "companies", label: "Firme", count: companies.length, href: "/admin?tab=companies" },
    { value: "users", label: "Korisnici", count: users.length, href: "/admin?tab=users" },
    { value: "log", label: "Dnevnik", href: "/admin?tab=log" },
  ];

  return (
    <>
      <PageHeader
        title="Admin panel"
        sub="Zahtevi za pristup, firme, korisnici i dnevnik aktivnosti za celu aplikaciju."
        actions={
          <Button variant="primary" onClick={() => setNewCompany(true)}>
            <Plus /> Nova firma
          </Button>
        }
        tabs={<UnderlineTabs value={tab} items={tabs} />}
      />

      <StatRow>
        <Stat label="Zahtevi na čekanju" value={pendingReqs.length} delta={pendingReqs.length ? "novo" : undefined} deltaTone="warn" />
        <Stat label="Firme" value={companies.length} sub={`${companies.filter((c) => c.status !== "active").length} blokirano`} />
        <Stat label="Korisnici" value={users.length} sub={`${users.filter((u) => !u.hasPassword).length} bez lozinke`} />
        <Stat
          label="Aktivni u poslednjih 7 dana"
          value={activeWeek}
        />
      </StatRow>

      {error && <div className="mb-4 rounded-lg border border-bad-line bg-bad-soft px-3 py-2.5 text-sm text-bad-ink">Greška: {error}</div>}

      {tab === "requests" && (
        <DataTable
          rows={requests}
          columns={reqCols}
          searchText={(r) => [r.companyName, r.email, r.contactName, r.pib].join(" ")}
          filters={[
            { value: "pending", label: "Na čekanju", predicate: (r) => r.status === "pending" },
            { value: "all", label: "Svi", predicate: () => true },
          ]}
          initialSort={{ key: "date", dir: "desc" }}
        />
      )}

      {tab === "companies" && (
        <DataTable
          rows={companies}
          columns={companyCols}
          searchText={(c) => [c.name, c.pib, ...c.members.map((m) => m.email)].join(" ")}
          initialSort={{ key: "created", dir: "desc" }}
          actions={(c) => {
            const owner = c.members.find((m) => m.role === "owner") ?? c.members[0];
            return [
              { label: "Dodaj člana / vlasnika", icon: <UserPlus />, onSelect: () => setAddMemberTo(c) },
              ...(owner ? [{ label: `Uđi kao ${owner.email}`, icon: <Eye />, onSelect: () => start(() => impersonate(owner.userId, c.id)) }] : []),
              c.status === "active"
                ? { label: "Blokiraj firmu", icon: <Ban />, danger: true, onSelect: () => run(() => setCompanyStatus(c.id, "blocked")) }
                : { label: "Aktiviraj firmu", icon: <RotateCcw />, onSelect: () => run(() => setCompanyStatus(c.id, "active")) },
            ];
          }}
        />
      )}

      {tab === "users" && (
        <DataTable
          rows={users}
          columns={userCols}
          searchText={(u) => [u.email, u.name, ...u.memberships.map((m) => m.company)].join(" ")}
          filters={[
            { value: "all", label: "Svi", predicate: () => true },
            { value: "nopw", label: "Bez lozinke", predicate: (u) => !u.hasPassword },
            { value: "blocked", label: "Blokirani", predicate: (u) => u.status !== "active" },
          ]}
          initialSort={{ key: "email", dir: "asc" }}
          actions={(u) => [
            { label: "Link za lozinku", icon: <Link2 />, onSelect: () => run(() => adminPasswordLink(u.id), u.email) },
            { label: "Privremena lozinka", icon: <KeyRound />, onSelect: () => run(() => adminTempPassword(u.id), u.email) },
            ...u.memberships.map((m) => ({ label: `Uđi kao · ${m.company}`, icon: <Eye />, onSelect: () => start(() => impersonate(u.id, m.companyId)) })),
            u.status === "active"
              ? { label: "Blokiraj nalog", icon: <Ban />, danger: true, onSelect: () => run(() => setUserStatus(u.id, "blocked")) }
              : { label: "Aktiviraj nalog", icon: <RotateCcw />, onSelect: () => run(() => setUserStatus(u.id, "active")) },
          ]}
        />
      )}

      {tab === "log" && <DataTable rows={log} columns={logCols} searchText={(l) => [l.actor, l.action, l.company, JSON.stringify(l.details)].join(" ")} initialSort={{ key: "at", dir: "desc" }} />}

      <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
        <Dot tone="accent" /> Lozinke se čuvaju kao nepovratni otisak i ne mogu se videti. Korisniku pošalji link ili privremenu lozinku.
      </p>

      <NewCompanyModal open={newCompany} onClose={() => setNewCompany(false)} onDone={(link, who) => (link ? setSecret({ kind: "link", value: link, who }) : null)} />
      <AddMemberModal company={addMemberTo} onClose={() => setAddMemberTo(null)} onDone={(link, who) => (link ? setSecret({ kind: "link", value: link, who }) : null)} />
      <SecretModal secret={secret} onClose={() => setSecret(null)} />
    </>
  );
}

function FormModal({ open, onClose, title, children, onSubmit, pending, submitLabel, error }: { open: boolean; onClose: () => void; title: string; children: ReactNode; onSubmit: () => void; pending: boolean; submitLabel: string; error?: string | null }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3.5">
          <span className="text-sm text-bad-ink">{error}</span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Otkaži</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Čuvam…" : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function NewCompanyModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (link: string | null | undefined, who: string) => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", pib: "", address: "", ownerName: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Nova firma"
      pending={pending}
      error={error}
      submitLabel="Napravi firmu"
      onSubmit={() =>
        start(async () => {
          const r = await createCompany(v).catch((e: unknown) => ({ ok: false as const, error: failMsg(e) }));
          if (!r.ok) return setError(r.error === "email" ? "Unesi ispravan email vlasnika." : r.error === "name" ? "Unesi naziv firme." : r.error);
          setError(null);
          onClose();
          onDone(r.link, v.email);
          setV({ name: "", pib: "", address: "", ownerName: "", email: "" });
          router.refresh();
        })
      }
    >
      <FieldShell label="Naziv firme *" span={2} htmlFor="nc-name">
        <TextInput id="nc-name" value={v.name} onChange={set("name")} />
      </FieldShell>
      <FieldShell label="PIB" htmlFor="nc-pib">
        <TextInput id="nc-pib" value={v.pib} onChange={set("pib")} />
      </FieldShell>
      <FieldShell label="Adresa" htmlFor="nc-addr">
        <TextInput id="nc-addr" value={v.address} onChange={set("address")} />
      </FieldShell>
      <FieldShell label="Ime vlasnika" htmlFor="nc-owner">
        <TextInput id="nc-owner" value={v.ownerName} onChange={set("ownerName")} />
      </FieldShell>
      <FieldShell label="Email vlasnika *" htmlFor="nc-email">
        <TextInput id="nc-email" type="email" value={v.email} onChange={set("email")} />
      </FieldShell>
      <p className="flex gap-2 text-xs text-ink-3 sm:col-span-2">
        <Building2 className="shrink-0" /> Vlasnik dobija link za postavljanje lozinke. Ako već ima nalog u drugoj firmi, samo mu se doda ova firma.
      </p>
    </FormModal>
  );
}

function AddMemberModal({ company, onClose, onDone }: { company: Company | null; onClose: () => void; onDone: (link: string | null | undefined, who: string) => void }) {
  const router = useRouter();
  const [v, setV] = useState({ email: "", name: "", role: "owner" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormModal
      open={!!company}
      onClose={onClose}
      title={`Dodaj člana · ${company?.name ?? ""}`}
      pending={pending}
      error={error}
      submitLabel="Dodaj"
      onSubmit={() =>
        start(async () => {
          if (!company) return;
          const r = await addCompanyMember(company.id, v).catch((e: unknown) => ({ ok: false as const, error: failMsg(e) }));
          if (!r.ok) return setError(r.error === "bad" ? "Proveri email i ulogu." : r.error);
          setError(null);
          onClose();
          onDone(r.link, v.email);
          setV({ email: "", name: "", role: "owner" });
          router.refresh();
        })
      }
    >
      <FieldShell label="Email *" span={2} htmlFor="am-email">
        <TextInput id="am-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </FieldShell>
      <FieldShell label="Ime i prezime" htmlFor="am-name">
        <TextInput id="am-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </FieldShell>
      <FieldShell label="Uloga" htmlFor="am-role">
        <Select id="am-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label.sr}
            </option>
          ))}
        </Select>
      </FieldShell>
      <p className="flex gap-2 text-xs text-ink-3 sm:col-span-2">
        <CheckCircle2 className="shrink-0" /> Prava se postavljaju po ulozi; vlasnik firme ih posle može menjati u Podešavanja → Članovi.
      </p>
    </FormModal>
  );
}

