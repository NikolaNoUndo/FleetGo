import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations should use the direct / session connection (port 5432), not the transaction pooler.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
