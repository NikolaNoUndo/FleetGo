"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteRecord } from "@/app/actions";
import { RecordForm } from "./record-form";
import { usePrefs } from "./prefs";
import { Button } from "./ui/primitives";
import { Modal, Segmented } from "./ui/client";
import { RESOURCES, type Refs, type ResourceKey } from "@/lib/resources";

export function DetailTabs({ tabs }: { tabs: { key: string; label: string; count?: number; content: ReactNode }[] }) {
  const [tab, setTab] = useState(tabs[0]?.key);
  return (
    <div>
      <Segmented className="mb-3" value={tab} onChange={setTab} items={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))} />
      {tabs.map((t) => (
        <div key={t.key} hidden={t.key !== tab}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

export function RecordActions({ resource, record, refs, listHref }: { resource: ResourceKey; record: Record<string, unknown> & { id: string }; refs: Refs; listHref: string }) {
  const { t } = usePrefs();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const noun = t(RESOURCES[resource].title);
  return (
    <>
      <Button onClick={() => setDel(true)} variant="ghost" size="md" aria-label={t("c.delete")}>
        <Trash2 size={16} />
      </Button>
      <Button onClick={() => setEdit(true)} variant="secondary">
        <Pencil size={15} />
        {t("c.edit")}
      </Button>
      <Modal open={edit} onClose={() => setEdit(false)} title={`${t("c.edit")} ${noun}`}>
        {edit && <RecordForm resource={resource} record={record} refs={refs} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} />}
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title={`${t("c.delete")} ${noun}`}>
        <p className="px-5 py-5 text-[14px] leading-relaxed text-ink-2">{t("c.confirmDelete")}</p>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3.5">
          <Button onClick={() => setDel(false)}>{t("c.cancel")}</Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await deleteRecord(resource, record.id);
              router.push(listHref);
            }}
          >
            <Trash2 size={15} />
            {t("c.delete")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
