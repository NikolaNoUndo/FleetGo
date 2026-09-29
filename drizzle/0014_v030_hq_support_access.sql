ALTER TABLE "companies" ADD COLUMN "hq_lat" double precision;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "hq_lng" double precision;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "support_access_until" timestamp with time zone;--> statement-breakpoint
-- the head office moves from map places to company settings; places of kind hq / parking go away
UPDATE "companies" c SET "hq_lat" = p."lat", "hq_lng" = p."lng"
FROM (SELECT DISTINCT ON ("company_id") "company_id", "lat", "lng" FROM "places" WHERE "kind" = 'hq' ORDER BY "company_id", "created_at") p
WHERE p."company_id" = c."id" AND c."hq_lat" IS NULL;--> statement-breakpoint
DELETE FROM "places" WHERE "kind" IN ('hq', 'parking');
