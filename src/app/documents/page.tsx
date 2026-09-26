import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, FileClock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { Stat, StatRow } from "@/components/stat";
import { DocumentsTable } from "@/components/tables/records";
import { getT } from "@/lib/prefs";
import { documentsWithOwner, getRefs } from "@/lib/queries";
import { getMoney } from "@/lib/money-server";
import { expiryState } from "@/lib/format";

export const metadata: Metadata = { title: "Rokovi i dokumenta" };

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const sp = await props.searchParams;
  const [t, rows, { refs }, m] = await Promise.all([getT(), documentsWithOwner(), getRefs(), getMoney()]);
  const states = rows.map((r) => expiryState(r.expiresAt, m.warnDays));
  const count = (s: string) => states.filter((x) => x === s).length;
  return (
    <>
      <PageHeader title={t("p.documents.title")} sub={t("p.documents.sub")} />
      <StatRow>
        <Stat icon={<FileClock />} label={t("c.all")} value={rows.length} />
        <Stat icon={<XCircle />} label={t("e.expired")} value={count("expired")} />
        <Stat icon={<AlertTriangle />} label={t("d.soon", { n: m.warnDays })} value={count("soon")} />
        <Stat icon={<CheckCircle2 />} label={t("e.ok")} value={count("ok")} />
      </StatRow>
      <DocumentsTable rows={rows} refs={refs} initialFilter={sp.filter === "attention" ? "attention" : undefined} />
    </>
  );
}
