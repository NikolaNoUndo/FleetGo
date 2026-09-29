CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date" date NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"supplier_id" uuid,
	"vehicle_id" uuid,
	"trailer_id" uuid,
	"invoice_no" text,
	"amount" numeric(12, 2),
	"currency" text DEFAULT 'RSD' NOT NULL,
	"paid" boolean DEFAULT true NOT NULL,
	"cost_from" date,
	"spread_months" integer DEFAULT 1 NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurring_until" date,
	"recurring_next" date,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trailer_id_trailers_id_fk" FOREIGN KEY ("trailer_id") REFERENCES "public"."trailers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_parent_id_expenses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_company_idx" ON "expenses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "expenses_recurring_idx" ON "expenses" USING btree ("company_id","recurring");--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;