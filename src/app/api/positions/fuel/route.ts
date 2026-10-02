import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getFuelLevel } from "@/lib/telematics";

export const dynamic = "force-dynamic";

/** Fuel level of one tracked unit (the company's own Wialon token, so only its own units). */
export async function GET(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.perms, "live") && !can(ctx.perms, "overview")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const unitId = new URL(req.url).searchParams.get("unit") ?? "";
  if (!/^\d{1,20}$/.test(unitId)) return NextResponse.json({ error: "unit" }, { status: 400 });
  try {
    const fuel = await getFuelLevel({ token: ctx.company.wialonToken, host: ctx.company.wialonHost }, unitId);
    return NextResponse.json({ ok: true, fuel }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Wialon fuel failed", (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
