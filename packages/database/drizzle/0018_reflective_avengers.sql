CREATE TABLE "source_quality_profiles" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"crawl_run_id" uuid,
	"item_count" integer DEFAULT 0 NOT NULL,
	"ai_relevant_count" integer DEFAULT 0 NOT NULL,
	"ai_relevant_share" numeric(5, 4) DEFAULT '0' NOT NULL,
	"in_stock_count" integer DEFAULT 0 NOT NULL,
	"out_of_stock_share" numeric(5, 4) DEFAULT '0' NOT NULL,
	"no_warranty_share" numeric(5, 4) DEFAULT '0' NOT NULL,
	"risk_fact_count" integer DEFAULT 0 NOT NULL,
	"contact_present" boolean DEFAULT false NOT NULL,
	"price_outlier_share" numeric(5, 4),
	"price_comparable_count" integer DEFAULT 0 NOT NULL,
	"catalog_overlap_max" numeric(5, 4),
	"catalog_overlap_source_id" uuid,
	"merchant_created_at" timestamp with time zone,
	"verdict" text DEFAULT 'review' NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"products" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "platform_kind" text;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "platform_merchant_id" text;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "discovery_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "vetting_result" jsonb;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "vetted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "next_vet_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "source_quality_profiles" ADD CONSTRAINT "source_quality_profiles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_quality_profiles" ADD CONSTRAINT "source_quality_profiles_crawl_run_id_crawl_runs_id_fk" FOREIGN KEY ("crawl_run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_quality_profiles" ADD CONSTRAINT "source_quality_profiles_catalog_overlap_source_id_sources_id_fk" FOREIGN KEY ("catalog_overlap_source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_quality_profiles_verdict_idx" ON "source_quality_profiles" USING btree ("verdict","computed_at");--> statement-breakpoint
ALTER TABLE "source_candidates" ADD CONSTRAINT "source_candidates_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD CONSTRAINT "source_candidates_submission_id_source_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."source_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_candidates_vetting_queue_idx" ON "source_candidates" USING btree ("status","priority","discovered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_candidates_identity_uidx" ON "source_candidates" USING btree ("platform_kind","platform_merchant_id") WHERE platform_merchant_id is not null;