import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * v0.1: the app runs as the owner of one company.
 * v0.2: replace this with the company from the signed-in user's session.
 */
export const getCompany = cache(async () => {
  const [company] = await db.select().from(schema.companies).orderBy(asc(schema.companies.createdAt)).limit(1);
  if (!company) {
    const [created] = await db.insert(schema.companies).values({ name: "Moja firma d.o.o." }).returning();
    return created;
  }
  return company;
});

export async function getCompanyId(): Promise<string> {
  return (await getCompany()).id;
}
