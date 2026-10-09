CREATE TABLE "toll_prices" (
	"system" text PRIMARY KEY NOT NULL,
	"names" jsonb NOT NULL,
	"prices" jsonb NOT NULL,
	"currency" text NOT NULL,
	"source" text NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"missing" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "toll_ramps" (
	"system" text NOT NULL,
	"station" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL
);
--> statement-breakpoint
CREATE INDEX "toll_ramps_system_idx" ON "toll_ramps" USING btree ("system");--> statement-breakpoint
ALTER TABLE "toll_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "toll_ramps" ENABLE ROW LEVEL SECURITY;
