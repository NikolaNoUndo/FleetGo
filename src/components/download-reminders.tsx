"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellPlus } from "lucide-react";
import { addDownloadReminders } from "@/app/actions";
import { usePrefs } from "./prefs";
import { Button } from "./ui/primitives";

/** One click: download reminders (card monthly, tachograph every 3 months) for every driver and truck missing one. */
export function DownloadRemindersButton({ missing }: { missing: number }) {
  const { locale } = usePrefs();
  const sr = locale === "sr";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  if (!missing && done === null) return null;
  return (
    <Button
      disabled={pending || done !== null}
      onClick={() =>
        start(async () => {
          const r = await addDownloadReminders();
          if (r.ok) {
            setDone(r.added);
            router.refresh();
          }
        })
      }
      title={sr ? "Kartica vozača na 28 dana, tahograf na 90 dana" : "Driver card every 28 days, tachograph every 90 days"}
    >
      <BellPlus />
      {done !== null ? (sr ? `Dodato ${done}` : `Added ${done}`) : sr ? `Podsetnici za očitavanje (${missing})` : `Download reminders (${missing})`}
    </Button>
  );
}
