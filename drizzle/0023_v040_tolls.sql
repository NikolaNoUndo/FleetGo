CREATE TABLE "toll_cells" (
	"cell" bigint NOT NULL,
	"country" text NOT NULL,
	CONSTRAINT "toll_cells_cell_country_pk" PRIMARY KEY("cell","country")
);
--> statement-breakpoint
CREATE TABLE "toll_network" (
	"country" text PRIMARY KEY NOT NULL,
	"ways" integer DEFAULT 0 NOT NULL,
	"km" integer DEFAULT 0 NOT NULL,
	"cells" integer DEFAULT 0 NOT NULL,
	"tiles_done" integer DEFAULT 0 NOT NULL,
	"tiles_total" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "time_from" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "time_to" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "toll_manual" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "toll_currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "toll_calc" jsonb;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "axles" integer;--> statement-breakpoint
CREATE INDEX "toll_cells_country_idx" ON "toll_cells" USING btree ("country");--> statement-breakpoint
ALTER TABLE "toll_cells" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "toll_network" ENABLE ROW LEVEL SECURITY;
