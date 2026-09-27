CREATE TABLE "vehicle_trailers" (
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"trailer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_trailers_vehicle_id_trailer_id_pk" PRIMARY KEY("vehicle_id","trailer_id")
);
--> statement-breakpoint
ALTER TABLE "trailers" DROP CONSTRAINT "trailers_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "vehicle_trailers" ADD CONSTRAINT "vehicle_trailers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_trailers" ADD CONSTRAINT "vehicle_trailers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_trailers" ADD CONSTRAINT "vehicle_trailers_trailer_id_trailers_id_fk" FOREIGN KEY ("trailer_id") REFERENCES "public"."trailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_trailers_trailer_idx" ON "vehicle_trailers" USING btree ("trailer_id");--> statement-breakpoint
CREATE INDEX "vehicle_trailers_company_idx" ON "vehicle_trailers" USING btree ("company_id");--> statement-breakpoint
-- keep today's links: each trailer's coupled truck becomes a vehicle_trailers row
INSERT INTO "vehicle_trailers" ("company_id", "vehicle_id", "trailer_id")
SELECT t."company_id", t."vehicle_id", t."id" FROM "trailers" t
JOIN "vehicles" v ON v."id" = t."vehicle_id" AND v."company_id" = t."company_id"
WHERE t."vehicle_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "vehicle_trailers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trailers" DROP COLUMN "vehicle_id";