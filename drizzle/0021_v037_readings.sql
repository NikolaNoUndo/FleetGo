ALTER TABLE "employees" ADD COLUMN "card_read_at" date;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "tacho_read_at" date;--> statement-breakpoint
UPDATE "vehicles" v SET "tacho_read_at" = d.last FROM (SELECT "entity_id", max(coalesce("issued_at", "expires_at" - 90)) AS last FROM "documents" WHERE "doc_type" = 'tacho_download' AND "entity_type" = 'vehicle' GROUP BY "entity_id") d WHERE d."entity_id" = v."id" AND d.last <= current_date;--> statement-breakpoint
UPDATE "employees" e SET "card_read_at" = d.last FROM (SELECT "entity_id", max(coalesce("issued_at", "expires_at" - 28)) AS last FROM "documents" WHERE "doc_type" = 'card_download' AND "entity_type" = 'employee' GROUP BY "entity_id") d WHERE d."entity_id" = e."id" AND d.last <= current_date;--> statement-breakpoint
DELETE FROM "documents" WHERE "doc_type" IN ('tacho_download', 'card_download');
