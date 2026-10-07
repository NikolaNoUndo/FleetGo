"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { sendFeedback } from "@/app/actions";
import { usePrefs } from "./prefs";
import { Button, cn } from "./ui/primitives";
import { Modal, TextArea } from "./ui/client";

/**
 * "Pošalji utisak": in the sidebar above Settings. A short note (what someone said,
 * what is missing, what doesn't work) that lands in the admin panel under Utisci.
 */
export function FeedbackButton({ rail, onClick }: { rail?: boolean; onClick: () => void }) {
  const { locale } = usePrefs();
  const label = locale === "sr" ? "Pošalji utisak" : "Send feedback";
  return rail ? (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="focus-ring relative mx-auto grid size-9 place-items-center rounded-lg text-side-ink-2 transition-colors hover:bg-side-2 hover:text-side-ink"
    >
      <MessageSquareText size={16} />
    </button>
  ) : (
    <button type="button" onClick={onClick} className="focus-ring flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-side-ink transition-colors hover:bg-side-2">
      <MessageSquareText />
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

/** The dialog lives outside the (phone) drawer, so closing the drawer doesn't close it. */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = usePrefs();
  return (
    <Modal open={open} onClose={onClose} title={locale === "sr" ? "Pošalji utisak" : "Send feedback"}>
      {open && <FeedbackForm onClose={onClose} />}
    </Modal>
  );
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const page = usePathname();
  const [message, setMessage] = useState("");
  const [human, setHuman] = useState(false);
  const [website, setWebsite] = useState(""); // never shown; only bots fill it in
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  // when the form was opened (bots send instantly)
  const [openedAt] = useState(() => Date.now());

  if (sent) {
    return (
      <div>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-good-soft text-good">
            <CheckCircle2 size={24} />
          </span>
          <h3 className="mt-4 text-base font-semibold text-ink">{sr ? "Hvala, stiglo je." : "Thanks, it's in."}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-ink-2">{sr ? "Pročitaćemo i javiti se ako treba nešto da pitamo." : "We'll read it and get back to you if we need to ask anything."}</p>
        </div>
        <div className="flex justify-end border-t border-line bg-surface-2/60 px-4 py-3">
          <Button variant="primary" onClick={onClose}>
            {sr ? "Zatvori" : "Close"}
          </Button>
        </div>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await sendFeedback({ message, page, human, website, openedAt });
      if (r.ok) setSent(true);
      else setError(r.message);
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col gap-4 px-4 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">{sr ? "Šta želiš da nam kažeš?" : "What would you like to tell us?"}</span>
          <TextArea
            autoFocus
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            placeholder={sr ? "Npr. dispečer bi hteo da vidi… / ne radi mi… / fali nam…" : "E.g. the dispatcher would like to see… / this doesn't work… / we're missing…"}
          />
        </label>
        {/* bots fill every field; people never see this one */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden />
        <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-sm font-medium text-ink-2">
          <input type="checkbox" checked={human} onChange={(e) => setHuman(e.target.checked)} className="size-[18px] rounded accent-[var(--accent)]" />
          {sr ? "Nisam robot" : "I'm not a robot"}
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3">
        <span className={cn("text-sm", error ? "text-bad" : "text-ink-3")}>{error}</span>
        <div className="flex gap-2">
          <Button onClick={onClose}>{sr ? "Otkaži" : "Cancel"}</Button>
          <Button type="submit" variant="primary" disabled={pending || message.trim().length < 3 || !human}>
            {pending ? (sr ? "Šaljem…" : "Sending…") : sr ? "Pošalji" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
