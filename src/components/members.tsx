"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Pencil, Trash2, UserPlus } from "lucide-react";
import { addMember, memberLink, removeMember, updateMember, type MemberResult } from "@/app/(app)/settings/members-actions";
import { DataTable, IconTile, type Column } from "./data-table";
import { usePrefs } from "./prefs";
import { Badge, Button, cn } from "./ui/primitives";
import { FieldShell, Modal, Segmented, TextInput } from "./ui/client";
import { Stack } from "./tables/common";
import { effectivePerms, MODULES, ROLE_PRESETS, ROLES, type Access, type Perms, type Role } from "@/lib/auth/permissions";

export type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: Record<string, Access>;
  hasPassword: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
};

const ERRORS: Record<string, { sr: string; en: string }> = {
  email: { sr: "Unesi ispravan email.", en: "Enter a valid email." },
  exists: { sr: "Ova osoba je već član firme.", en: "This person is already a member." },
  "last-owner": { sr: "Firma mora imati bar jednog vlasnika.", en: "The company needs at least one owner." },
  "has-password": { sr: "Ova osoba već ima lozinku. Novu lozinku može da postavi samo administrator.", en: "This person already has a password. Only the administrator can reset it." },
};

/** none / view / edit per module; disabled for owners (they always have everything). */
function PermissionMatrix({ value, onChange, disabled }: { value: Perms; onChange: (p: Perms) => void; disabled?: boolean }) {
  const { locale } = usePrefs();
  const L = locale === "sr" ? { none: "Nema", view: "Gleda", edit: "Menja" } : { none: "None", view: "View", edit: "Edit" };
  return (
    <div className={cn("divide-y divide-line rounded-xl border border-line", disabled && "opacity-60")}>
      {MODULES.map((m) => (
        <div key={m.key} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 text-sm">
            {m.label[locale]}
            {"hint" in m && m.hint && <span className="block text-xs text-ink-3">{m.hint[locale]}</span>}
          </span>
          {disabled ? (
            <Badge tone="good">{L.edit}</Badge>
          ) : (
            <Segmented
              size="sm"
              value={value[m.key]}
              onChange={(a) => onChange({ ...value, [m.key]: a })}
              items={(["none", "view", "edit"] as const)
                .filter((a) => !("levels" in m) || (m.levels as readonly string[]).includes(a))
                .map((a) => ({ value: a, label: L[a] }))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const { locale } = usePrefs();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            "focus-ring rounded-xl border px-3 py-2.5 text-left transition-colors",
            value === r.value ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
          )}
        >
          <span className="block text-sm font-medium">{r.label[locale]}</span>
          <span className="block text-xs text-ink-3">{r.hint[locale]}</span>
        </button>
      ))}
    </div>
  );
}

function LinkBox({ path }: { path: string }) {
  const { locale } = usePrefs();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin + path : path;
  return (
    <div className="space-y-2 rounded-xl border border-good-line bg-good-soft p-4">
      <p className="text-sm text-good-ink">
        {locale === "sr"
          ? "Pošalji ovaj link osobi da postavi lozinku. Važi 7 dana i može se iskoristiti jednom."
          : "Send this link so they can set a password. Valid for 7 days, single use."}
      </p>
      <div className="flex gap-2">
        <TextInput readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? (locale === "sr" ? "Kopirano" : "Copied") : locale === "sr" ? "Kopiraj" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function MembersManager({ members }: { members: MemberRow[] }) {
  const { locale, date } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<MemberRow | "new" | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<{ email: string; name: string; role: Role; perms: Perms }>({ email: "", name: "", role: "dispatcher", perms: ROLE_PRESETS.dispatcher });
  const openNew = () => {
    setForm({ email: "", name: "", role: "dispatcher", perms: ROLE_PRESETS.dispatcher });
    setError(null);
    setLink(null);
    setEditing("new");
  };
  const openEdit = (m: MemberRow) => {
    const role = (ROLES.some((r) => r.value === m.role) ? m.role : "dispatcher") as Role;
    setForm({ email: m.email, name: m.name ?? "", role, perms: effectivePerms(role, m.permissions) });
    setError(null);
    setLink(null);
    setEditing(m);
  };
  const handle = (r: MemberResult, close = true) => {
    if (!r.ok) {
      setError(ERRORS[r.error]?.[locale] ?? r.error);
      return false;
    }
    setError(null);
    router.refresh();
    if (r.link) setLink(r.link);
    else if (close) setEditing(null);
    return true;
  };

  const summary = (m: MemberRow) => {
    if (m.role === "owner") return sr ? "Sve" : "Everything";
    const p = effectivePerms(m.role, m.permissions);
    const edit = MODULES.filter((x) => p[x.key] === "edit").length;
    const view = MODULES.filter((x) => p[x.key] === "view").length;
    return sr ? `${edit} menja · ${view} gleda` : `${edit} edit · ${view} view`;
  };

  const cols: Column<MemberRow>[] = [
    {
      key: "who", m: "title",
      header: sr ? "Član" : "Member",
      sortValue: (m) => m.email,
      render: (m) => <Stack main={<>{m.name || m.email}{m.isSelf && <span className="ml-1.5 text-xs font-normal text-ink-3">({sr ? "ti" : "you"})</span>}</>} sub={m.name ? m.email : undefined} />,
    },
    { key: "role", m: "end", header: sr ? "Uloga" : "Role", sortValue: (m) => m.role, render: (m) => <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{ROLES.find((r) => r.value === m.role)?.label[locale] ?? m.role}</Badge> },
    { key: "access", m: "sub", header: sr ? "Pristup" : "Access", hide: "md", render: (m) => <span className="text-ink-2">{summary(m)}</span> },
    {
      key: "status", m: "end2",
      header: "Status",
      render: (m) => (m.hasPassword ? <span className="text-ink-2">{m.lastLoginAt ? `${sr ? "Prijava" : "Signed in"} ${date(m.lastLoginAt.slice(0, 10))}` : sr ? "Aktivan" : "Active"}</span> : <Badge tone="warn">{sr ? "Čeka lozinku" : "Awaiting password"}</Badge>),
    },
  ];

  const isNew = editing === "new";
  return (
    <>
      <DataTable
        flush
        rows={members}
        columns={cols}
        toolbar={
          <Button variant="dark" onClick={openNew}>
            <UserPlus /> {sr ? "Dodaj člana" : "Add member"}
          </Button>
        }
        actions={(m) => [
          { label: sr ? "Uloga i prava" : "Role & access", icon: <Pencil />, onSelect: () => openEdit(m) },
          ...(!m.hasPassword
            ? [{ label: sr ? "Novi link za lozinku" : "New password link", icon: <Link2 />, onSelect: () => start(async () => { const r = await memberLink(m.id); if (r.ok && r.link) { setEditing(m); setLink(r.link); } else if (!r.ok) setError(ERRORS[r.error]?.[locale] ?? r.error); }) }]
            : []),
          ...(!m.isSelf ? [{ label: sr ? "Ukloni iz firme" : "Remove", icon: <Trash2 />, danger: true, onSelect: () => start(async () => { handle(await removeMember(m.id)); }) }] : []),
        ]}
        initialSort={{ key: "role", dir: "desc" }}
        mIcon={(m) => <IconTile tone={m.role === "owner" ? "accent" : "gray"}>{(m.name || m.email).slice(0, 2).toUpperCase()}</IconTile>}
      />
      {error && !editing && <p className="px-4 pb-3 text-sm text-bad-ink">{error}</p>}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? (sr ? "Dodaj člana" : "Add member") : `${sr ? "Uloga i prava" : "Role & access"} · ${form.email}`} wide>
        {link ? (
          <div className="space-y-4 px-5 py-5">
            <LinkBox path={link} />
            <div className="flex justify-end">
              <Button onClick={() => setEditing(null)}>{sr ? "Gotovo" : "Done"}</Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                if (isNew) handle(await addMember({ email: form.email, name: form.name, role: form.role, permissions: form.perms }));
                else if (editing && typeof editing === "object") handle(await updateMember(editing.id, { role: form.role, permissions: form.perms }));
              });
            }}
          >
            <div className="max-h-[calc(94dvh-128px)] space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:max-h-[68vh] sm:px-5">
              {isNew && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldShell label="Email *" htmlFor="m-email">
                    <TextInput id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
                  </FieldShell>
                  <FieldShell label={sr ? "Ime i prezime" : "Name"} htmlFor="m-name">
                    <TextInput id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </FieldShell>
                </div>
              )}
              <div>
                <div className="mb-2 text-xs font-medium text-ink-2">{sr ? "Uloga" : "Role"}</div>
                <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role, perms: ROLE_PRESETS[role] })} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-2">
                  <span>{sr ? "Šta vidi i menja" : "What they can see and change"}</span>
                  {form.role !== "owner" && (
                    <button type="button" className="text-accent-ink hover:underline" onClick={() => setForm({ ...form, perms: ROLE_PRESETS[form.role] })}>
                      {sr ? "Vrati na podrazumevano za ulogu" : "Reset to role defaults"}
                    </button>
                  )}
                </div>
                <PermissionMatrix value={form.perms} onChange={(perms) => setForm({ ...form, perms })} disabled={form.role === "owner"} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3.5">
              <span className="text-sm text-bad-ink">{error}</span>
              <div className="flex gap-2">
                <Button onClick={() => setEditing(null)}>{sr ? "Otkaži" : "Cancel"}</Button>
                <Button type="submit" variant="primary" disabled={pending}>
                  {isNew ? (sr ? "Dodaj" : "Add") : sr ? "Sačuvaj" : "Save"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
