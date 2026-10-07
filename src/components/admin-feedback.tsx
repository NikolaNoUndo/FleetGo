"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, RotateCcw, Trash2 } from "lucide-react";
import { deleteFeedback, setFeedbackRead } from "@/app/admin/actions";
import { Button } from "./ui/primitives";
import { Modal } from "./ui/client";

/** "Obrisati utisak?" — deleting can't be undone. */
export function DeleteFeedbackDialog({ id, onClose, onDeleted }: { id: string | null; onClose: () => void; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open={!!id} onClose={onClose} title="Obrisati utisak?">
      <p className="px-4 py-4 text-sm leading-relaxed text-ink-2">Utisak se briše zauvek i ne može da se vrati.</p>
      {error && <p className="px-4 pb-3 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
        <Button onClick={onClose}>Otkaži</Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            id &&
            start(async () => {
              const r = await deleteFeedback(id);
              if (!r.ok) return setError(r.error);
              onDeleted();
            })
          }
        >
          <Trash2 /> {pending ? "Brišem…" : "Obriši"}
        </Button>
      </div>
    </Modal>
  );
}

/** Buttons on a note's own page: reply by email, read/unread, delete. */
export function FeedbackActions({ id, read, email }: { id: string; read: boolean; email: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      {email && (
        <a href={`mailto:${email}?subject=${encodeURIComponent("Re: tvoj utisak o Roadline-u")}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-xs hover:bg-surface-2 sm:h-8 sm:px-3 [&_svg]:size-4">
          <Mail /> Odgovori mejlom
        </a>
      )}
      <Button disabled={pending} onClick={() => start(async () => void (await setFeedbackRead(id, !read), router.refresh()))}>
        {read ? (
          <>
            <RotateCcw /> Označi nepročitano
          </>
        ) : (
          <>
            <Check /> Označi pročitano
          </>
        )}
      </Button>
      <Button variant="danger" onClick={() => setDeleting(true)}>
        <Trash2 /> Obriši
      </Button>
      <DeleteFeedbackDialog id={deleting ? id : null} onClose={() => setDeleting(false)} onDeleted={() => router.push("/admin?tab=feedback")} />
    </>
  );
}

/** Opening an unread note marks it read (once; "Označi nepročitano" afterwards sticks). */
export function MarkReadOnOpen({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (read || done.current) return;
    done.current = true;
    setFeedbackRead(id, true).then(() => router.refresh());
  }, [id, read, router]);
  return null;
}
