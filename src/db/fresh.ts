/**
 * Čist start za pravu firmu: briše SVE podatke iz baze (demo firmu i sve unose)
 * i pravi jednu praznu firmu sa tvojim nazivom.
 *
 *   npm run db:fresh -- --name "Moja Firma d.o.o." --yes
 *   (opciono)  --pib 123456789  --address "Ulica 1, Grad"  --rate 117.2
 *
 * Bez --yes samo ispisuje šta bi uradio i ništa ne briše.
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as raw } from "drizzle-orm";
import * as schema from "./schema";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL nije podešen u .env");

const name = arg("name");
const confirmed = process.argv.includes("--yes");

async function main() {
  if (!name) {
    console.log('Upiši naziv firme:  npm run db:fresh -- --name "Moja Firma d.o.o." --yes');
    process.exit(1);
  }
  const client = postgres(url!, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  const counts = await db.execute(raw`
    select (select count(*) from companies) c, (select count(*) from vehicles) v, (select count(*) from trailers) t,
           (select count(*) from employees) e, (select count(*) from documents) d, (select count(*) from fuel_entries) f,
           (select count(*) from services) s, (select count(*) from parts) p, (select count(*) from driver_payments) u`);
  const c = counts[0] as Record<string, string>;
  console.log(`U bazi trenutno: ${c.c} firma, ${c.v} vozila, ${c.t} prikolica, ${c.e} zaposlenih, ${c.d} dokumenata, ${c.f} sipanja, ${c.s} servisa, ${c.p} delova, ${c.u} uplata.`);

  if (!confirmed) {
    console.log(`\nNišta nije obrisano. Da obrišeš sve i napraviš praznu firmu "${name}", dodaj --yes na kraj komande.`);
    await client.end();
    return;
  }

  // Every table references companies with ON DELETE CASCADE, so this clears everything.
  await db.delete(schema.companies);
  const [company] = await db
    .insert(schema.companies)
    .values({
      name,
      pib: arg("pib") ?? null,
      address: arg("address") ?? null,
      eurRsdRate: arg("rate") ? Number(arg("rate")) : 117.2,
      warnDays: 30,
    })
    .returning();
  console.log(`\n✓ Gotovo. Baza je prazna, firma "${company.name}" je spremna. Pokreni npm run dev.`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
