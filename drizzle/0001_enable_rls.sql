-- Supabase exposes the public schema over its REST API (PostgREST).
-- FleetGo talks to Postgres directly from the server, so we switch RLS on with
-- no policies: the anon/authenticated API keys can read nothing, while the
-- server connection (table owner) is unaffected. v0.2 adds per-company policies.
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trailers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fuel_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "driver_payments" ENABLE ROW LEVEL SECURITY;
