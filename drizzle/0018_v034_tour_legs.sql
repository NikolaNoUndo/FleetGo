CREATE TABLE "tour_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tour_id" uuid NOT NULL,
	"from_place" text,
	"to_place" text,
	"date" date,
	"client_id" uuid,
	"price" numeric(12, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"distance_km" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tours" DROP CONSTRAINT "tours_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "tour_legs" ADD CONSTRAINT "tour_legs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_legs" ADD CONSTRAINT "tour_legs_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_legs" ADD CONSTRAINT "tour_legs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tour_legs_company_idx" ON "tour_legs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tour_legs_tour_idx" ON "tour_legs" USING btree ("tour_id");--> statement-breakpoint
CREATE INDEX "tour_legs_client_idx" ON "tour_legs" USING btree ("client_id");--> statement-breakpoint
-- tours made before legs existed: their route, client and price become the tour's first leg
INSERT INTO "tour_legs" ("company_id", "tour_id", "from_place", "to_place", "date", "client_id", "price", "currency", "distance_km")
SELECT "company_id", "id", "from_place", "to_place", "date_from", "client_id", "price", "currency", NULL
FROM "tours"
WHERE "from_place" IS NOT NULL OR "to_place" IS NOT NULL OR "client_id" IS NOT NULL OR "price" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "tour_legs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tours" DROP COLUMN "from_place";--> statement-breakpoint
ALTER TABLE "tours" DROP COLUMN "to_place";--> statement-breakpoint
ALTER TABLE "tours" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "tours" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "tours" DROP COLUMN "currency";