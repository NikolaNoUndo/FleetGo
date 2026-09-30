"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteRecord } from "@/app/actions";
import { RecordForm } from "./record-form";
import { usePrefs } from "./prefs";
import { Button } from "./ui/primitives";
import { Modal, UnderlineTabs } from "./ui/client";
import { RESOURCES, type Refs, type ResourceKey } from "@/lib/resources";

type Tab = { key: string; label: string; count?: number; content: ReactNode };
export function DetailTabs({ tabs: all }: { tabs: (Tab | false)[] }) {
  const tabs = all.filter(Boolean) as Tab[];
  const [tab, setTab] = useState(tabs[0]?.key);
  if (!tabs.length) return <div />;
  return (
    <div className="min-w-0">
      <div className="mb-4">
        <UnderlineTabs value={tab} onChange={setTab} items={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))} />
      </div>
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
        <Trash2 />
      </Button>
      <Button onClick={() => setEdit(true)} variant="secondary">
        <Pencil />
        {t("c.edit")}
      </Button>
      <Modal open={edit} onClose={() => setEdit(false)} title={`${t("c.edit")} ${noun}`}>
        {edit && <RecordForm resource={resource} record={record} refs={refs} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} />}
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title={`${t("c.delete")} ${noun}`}>
        <p className="px-4 py-4 text-sm leading-relaxed text-ink-2">{t("c.confirmDelete")}</p>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
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
            <Trash2 />
            {t("c.delete")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
