import "server-only";
import { db, schema } from "@/db";

/** Append-only activity log shown in the admin panel. Never throws. */
export async function audit(actor: string, action: string, details?: Record<string, unknown>, companyId?: string | null) {
  try {
    await db.insert(schema.auditLog).values({ actor, action, details: details ?? null, companyId: companyId ?? null });
  } catch (e) {
    console.error("audit failed", e);
  }
}
