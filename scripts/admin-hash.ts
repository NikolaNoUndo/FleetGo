/**
 * Generates ADMIN_PASSWORD_HASH for the admin panel.
 *   npm run admin:hash -- "tvoja-lozinka"
 * Put the printed line in .env and in Vercel → Settings → Environment Variables.
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Upotreba: npm run admin:hash -- "lozinka"');
  process.exit(1);
}
const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
console.log(`ADMIN_PASSWORD_HASH=${["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join(":")}`);
