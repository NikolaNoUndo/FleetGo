"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { addNote, deleteNote, updateNote, type AdminResult } from "@/app/admin/actions";
import { todayISO } from "@/lib/format";
import { Button, cn } from "./ui/primitives";
import { Segmented, TextArea } from "./ui/client";
import { DateField } from "./ui/date-field";

export type NoteItem = { id: string; kind: string; date: string | null; text: string; source: string; done: boolean; createdAt: string };

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const s = new Intl.DateTimeFormat("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<AdminResult>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn().catch(() => ({ ok: false as const, error: "Nije sačuvano, probaj ponovo." }));
      if (!r.ok) return setError(r.error);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

/** Who wrote it: a small "Claude" tag on what came with the code. */
const Source = ({ source }: { source: string }) =>
  source === "claude" ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-4" title="Upisao Claude uz izmenu koda">
      <Bot size={12} /> Claude
    </span>
  ) : null;

/** One line of a list that turns into a text box on "Izmeni". */
function NoteRow({ note, lead }: { note: NoteItem; lead?: React.ReactNode }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [date, setDate] = useState(note.date ?? "");
  if (editing)
    return (
      <li className="flex flex-col gap-2 px-4 py-3">
        {note.kind === "change" && (
          <div className="w-44">
            <DateField value={date} onChange={setDate} />
          </div>
        )}
        <TextArea autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-end gap-2">
          {error && <span className="mr-auto text-xs text-bad">{error}</span>}
          <Button size="sm" onClick={() => (setEditing(false), setText(note.text), setDate(note.date ?? ""))}>
            Otkaži
          </Button>
          <Button size="sm" variant="primary" disabled={pending || !text.trim()} onClick={() => run(() => updateNote(note.id, { text, ...(note.kind === "change" ? { date } : {}) }), () => setEditing(false))}>
            Sačuvaj
          </Button>
        </div>
      </li>
    );
  return (
    <li className="group flex items-start gap-3 px-4 py-2.5">
      {lead}
      <p className={cn("min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-wrap", note.done ? "text-ink-3 line-through" : "text-ink")}>{note.text}</p>
      <Source source={note.source} />
      <div className="-my-1 flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" title="Izmeni" onClick={() => setEditing(true)} className="focus-ring grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink">
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="Obriši"
          disabled={pending}
          onClick={() => window.confirm("Obrisati ovu stavku?") && run(() => deleteNote(note.id))}
          className="focus-ring grid size-7 place-items-center rounded-md text-ink-3 hover:bg-bad-soft hover:text-bad"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

/** "Izmene": what changed on which day, newest day first. */
export function ChangesTab({ notes }: { notes: NoteItem[] }) {
  const { pending, error, run } = useRun();
  const [date, setDate] = useState(todayISO());
  const [text, setText] = useState("");
  const changes = notes.filter((n) => n.kind === "change" && n.date);
  const days = [...new Set(changes.map((n) => n.date as string))].sort().reverse();

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addNote("change", text, date), () => setText(""));
        }}
        className="rounded-xl border border-line bg-surface p-4 shadow-xs"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="w-full sm:w-44">
            <DateField value={date} onChange={setDate} />
          </div>
          <TextArea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Šta je promenjeno? Npr. dodato „Označi plaćeno” u meniju…" className="flex-1" />
          <Button type="submit" variant="primary" disabled={pending || !text.trim() || !date}>
            <Plus /> Dodaj
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </form>

      {days.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">Još nema upisanih izmena.</p>
      ) : (
        days.map((d) => (
          <section key={d} className="rounded-xl border border-line bg-surface shadow-xs">
            <header className="flex h-11 items-center justify-between border-b border-line/70 px-4">
              <h2 className="text-sm font-semibold text-ink">{dayLabel(d)}</h2>
              <span className="text-xs text-ink-3 tnum">{changes.filter((n) => n.date === d).length}</span>
            </header>
            <ul className="divide-y divide-line/60">
              {changes
                .filter((n) => n.date === d)
                .map((n) => (
                  <NoteRow key={n.id} note={n} lead={<span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />} />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** "Ideje": things to come back to; tick them off when done. */
export function IdeasTab({ notes }: { notes: NoteItem[] }) {
  const { pending, error, run } = useRun();
  const [text, setText] = useState("");
  const [show, setShow] = useState<"open" | "done">("open");
  const ideas = notes.filter((n) => n.kind === "idea");
  const open = ideas.filter((n) => !n.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = ideas.filter((n) => n.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = show === "open" ? open : done;

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addNote("idea", text), () => setText(""));
        }}
        className="rounded-xl border border-line bg-surface p-4 shadow-xs"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <TextArea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
            }}
            placeholder="Ideja, nešto što je neko rekao, šta ne smem da zaboravim…"
            className="flex-1"
          />
          <Button type="submit" variant="primary" disabled={pending || !text.trim()}>
            <Lightbulb /> Zapamti
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </form>

      <section className="rounded-xl border border-line bg-surface shadow-xs">
        <header className="flex h-12 items-center justify-between border-b border-line/70 px-3">
          <Segmented
            value={show}
            onChange={setShow}
            items={[
              { value: "open", label: "Otvorene", count: open.length },
              { value: "done", label: "Urađene", count: done.length },
            ]}
          />
        </header>
        {list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-3">{show === "open" ? "Nema otvorenih ideja." : "Još ništa nije označeno kao urađeno."}</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {list.map((n) => (
              <NoteRow key={n.id} note={n} lead={<DoneBox note={n} />} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DoneBox({ note }: { note: NoteItem }) {
  const { pending, run } = useRun();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={note.done}
      title={note.done ? "Vrati u otvorene" : "Označi urađeno"}
      disabled={pending}
      onClick={() => run(() => updateNote(note.id, { done: !note.done }))}
      className={cn(
        "focus-ring mt-0.5 grid size-[18px] shrink-0 place-items-center rounded border transition-colors",
        note.done ? "border-accent bg-accent text-white" : "border-line-strong bg-surface hover:border-accent",
      )}
    >
      {note.done && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

