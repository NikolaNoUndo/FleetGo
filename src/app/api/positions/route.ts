import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPositions } from "@/lib/telematics";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.perms, "live") && !can(ctx.perms, "overview")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const companyId = ctx.company.id;
  const rows = await db
    .select({
      id: schema.vehicles.id,
      plate: schema.vehicles.plate,
      wialonUnitId: schema.vehicles.wialonUnitId,
      status: schema.vehicles.status,
      extraDriverIds: schema.vehicles.extraDriverIds,
      firstName: schema.employees.firstName,
      lastName: schema.employees.lastName,
    })
    .from(schema.vehicles)
    .leftJoin(schema.employees, eq(schema.employees.id, schema.vehicles.driverId))
    .where(eq(schema.vehicles.companyId, companyId));

  const extraIds = [...new Set(rows.flatMap((r) => r.extraDriverIds))];
  const extraNames = new Map(
    extraIds.length
      ? (await db.select({ id: schema.employees.id, f: schema.employees.firstName, l: schema.employees.lastName }).from(schema.employees).where(and(eq(schema.employees.companyId, companyId), inArray(schema.employees.id, extraIds)))).map((e) => [e.id, `${e.f} ${e.l}`])
      : [],
  );
  const vehicles = rows.map((r) => ({
    id: r.id,
    plate: r.plate,
    wialonUnitId: r.wialonUnitId,
    status: r.status,
    driverName: [r.firstName ? `${r.firstName} ${r.lastName}` : null, ...r.extraDriverIds.map((x) => extraNames.get(x))].filter(Boolean).join(", ") || null,
  }));
  const result = await getPositions({ token: ctx.company.wialonToken, host: ctx.company.wialonHost }, vehicles);
  return NextResponse.json({ ...result, vehicles }, { headers: { "Cache-Control": "no-store" } });
}
