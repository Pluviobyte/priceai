CREATE TABLE "source_catalog_type_snapshots" (
	"source_id" uuid NOT NULL,
	"goods_type" text NOT NULL,
	"run_id" uuid NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"item_count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_runs" ADD COLUMN "catalog_scope" jsonb;--> statement-breakpoint
ALTER TABLE "raw_offer_snapshots" ADD COLUMN "goods_type" text;--> statement-breakpoint
ALTER TABLE "source_catalog_type_snapshots" ADD CONSTRAINT "source_catalog_type_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_catalog_type_snapshots" ADD CONSTRAINT "source_catalog_type_snapshots_run_id_crawl_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_catalog_type_uidx" ON "source_catalog_type_snapshots" USING btree ("source_id","goods_type");