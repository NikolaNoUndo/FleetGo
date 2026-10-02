CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date,
	"from_place" text,
	"to_place" text,
	"vehicle_id" uuid,
	"trailer_id" uuid,
	"driver_id" uuid,
	"client_id" uuid,
	"price" numeric(12, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"distance_km" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_trailer_id_trailers_id_fk" FOREIGN KEY ("trailer_id") REFERENCES "public"."trailers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_driver_id_employees_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_company_idx" ON "clients" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_company_name_uq" ON "clients" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "tours_company_idx" ON "tours" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tours_vehicle_idx" ON "tours" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "tours_date_idx" ON "tours" USING btree ("date_from");--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tours" ENABLE ROW LEVEL SECURITY;