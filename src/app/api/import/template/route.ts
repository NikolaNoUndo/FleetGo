import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPrefs } from "@/lib/prefs";
import { buildTemplate } from "@/lib/fleet-import/server";

export const dynamic = "force-dynamic";

/** The Excel workbook to fill in (with what the company already has). */
export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(["vehicles", "trailers", "employees"] as const).some((m) => can(ctx.perms, m, "edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { locale } = await getPrefs();
  const buf = await buildTemplate(ctx.company.id, ctx.perms, locale);
  const name = locale === "sr" ? "Roadline-uvoz-flote.xlsx" : "Roadline-fleet-import.xlsx";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
