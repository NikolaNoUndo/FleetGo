import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
      firstName: schema.employees.firstName,
      lastName: schema.employees.lastName,
    })
    .from(schema.vehicles)
    .leftJoin(schema.employees, eq(schema.employees.id, schema.vehicles.driverId))
    .where(eq(schema.vehicles.companyId, companyId));

  const vehicles = rows.map((r) => ({
    id: r.id,
    plate: r.plate,
    wialonUnitId: r.wialonUnitId,
    status: r.status,
    driverName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
  }));
  const result = await getPositions(vehicles);
  return NextResponse.json({ ...result, vehicles }, { headers: { "Cache-Control": "no-store" } });
}
