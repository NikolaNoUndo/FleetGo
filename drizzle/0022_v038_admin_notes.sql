CREATE TABLE "admin_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"date" date,
	"text" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"key" text,
	"done" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_notes_key_uq" ON "admin_notes" USING btree ("key");--> statement-breakpoint
CREATE INDEX "admin_notes_kind_idx" ON "admin_notes" USING btree ("kind","date");--> statement-breakpoint
ALTER TABLE "admin_notes" ENABLE ROW LEVEL SECURITY;
