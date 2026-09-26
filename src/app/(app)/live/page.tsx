import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { LiveView } from "@/components/map/live-view";
import { getT } from "@/lib/prefs";

export const metadata: Metadata = { title: "Mapa uživo" };

export default async function LivePage() {
  await requireAccess("live");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("p.live.title")} sub={t("p.live.sub")} />
      <LiveView />
    </>
  );
}
