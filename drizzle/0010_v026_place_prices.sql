ALTER TABLE "places" ADD COLUMN "diesel_price" double precision;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "price_currency" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "price_updated_at" timestamp with time zone;