// Vercel build: apply database migrations, then build the app.
// Prints which variables are present (never their values) to make setup problems obvious.
import { execSync } from "node:child_process";

const vars = ["DATABASE_URL", "DIRECT_URL", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH"];
for (const k of vars) {
  const v = process.env[k]?.trim();
  console.log(`${k}: ${v ? `podešen (${v.length} znakova)` : "NIJE PODEŠEN"}`);
}

const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    "\nDATABASE_URL i DIRECT_URL su prazni u ovom buildu.\n" +
      "Vercel → Settings → Environment Variables: otvori ⋯ → Edit i upiši vrednost (connection string iz Supabase-a),\n" +
      "označi Production i Preview, sačuvaj, pa Deployments → ⋯ → Redeploy.\n",
  );
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });
run("npx drizzle-kit migrate");
run("npx next build");
