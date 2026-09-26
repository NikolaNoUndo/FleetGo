-- Move free-text suppliers / workshops into the suppliers list.
INSERT INTO "suppliers" ("company_id", "name")
SELECT DISTINCT "company_id", btrim("supplier") FROM "parts" WHERE "supplier" IS NOT NULL AND btrim("supplier") <> ''
UNION
SELECT DISTINCT "company_id", btrim("workshop") FROM "services" WHERE "workshop" IS NOT NULL AND btrim("workshop") <> ''
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "parts" p SET "supplier_id" = s."id" FROM "suppliers" s
WHERE s."company_id" = p."company_id" AND s."name" = btrim(p."supplier") AND p."supplier_id" IS NULL;--> statement-breakpoint
UPDATE "services" v SET "supplier_id" = s."id" FROM "suppliers" s
WHERE s."company_id" = v."company_id" AND s."name" = btrim(v."workshop") AND v."supplier_id" IS NULL;--> statement-breakpoint
-- RLS on, no policies: the public Supabase API keys can read nothing; the server connection is unaffected.
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registration_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fx_rates" ENABLE ROW LEVEL SECURITY;
