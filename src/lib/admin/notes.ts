import "server-only";
import { asc, desc, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { CHANGES, IDEAS } from "@/content/notes";

/** Copies the changes and ideas shipped with the code into the table (each key once). */
export async function syncShippedNotes() {
  const rows = [
    ...CHANGES.map((c) => ({ kind: "change", key: c.key, date: c.date, text: c.text, source: "claude" })),
    ...IDEAS.map((i) => ({ kind: "idea", key: i.key, date: null, text: i.text, source: "claude" })),
  ];
  if (rows.length) await db.insert(schema.adminNotes).values(rows).onConflictDoNothing({ target: schema.adminNotes.key });
}

export async function listNotes() {
  await syncShippedNotes();
  const N = schema.adminNotes;
  return db.select().from(N).where(isNull(N.deletedAt)).orderBy(desc(N.date), asc(N.createdAt), asc(N.key));
}
