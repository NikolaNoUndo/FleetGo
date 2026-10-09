CREATE TABLE "toll_rows" (
	"r" integer NOT NULL,
	"country" text NOT NULL,
	"cols" integer[] NOT NULL,
	CONSTRAINT "toll_rows_r_country_pk" PRIMARY KEY("r","country")
);
--> statement-breakpoint
DROP TABLE "toll_cells" CASCADE;--> statement-breakpoint
ALTER TABLE "toll_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DELETE FROM "toll_network";
