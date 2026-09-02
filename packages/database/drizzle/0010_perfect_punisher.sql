CREATE TABLE "crawl_leases" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"hostname" text NOT NULL,
	"lease_token" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"query" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"operation" text NOT NULL,
	"error_code" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "llm_extraction_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_offer_snapshot_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"candidate" jsonb NOT NULL,
	"confidence" numeric(5, 4),
	"status" text DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "merchant_feed_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_name" text NOT NULL,
	"website_url" text NOT NULL,
	"feed_url" text NOT NULL,
	"schema_kind" text DEFAULT 'auto' NOT NULL,
	"contact" text NOT NULL,
	"notes" text,
	"submitter_fingerprint" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"review_note" text,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_offer_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publish_generation_id" uuid NOT NULL,
	"offer_id" uuid,
	"source_id" uuid NOT NULL,
	"source_item_id" text NOT NULL,
	"canonical_product_id" uuid NOT NULL,
	"latest_raw_snapshot_id" uuid NOT NULL,
	"price" numeric(20, 6) NOT NULL,
	"currency" text NOT NULL,
	"stock_count" integer,
	"stock_state" "stock_state" NOT NULL,
	"availability_state" "availability_state" NOT NULL,
	"freshness_state" "freshness_state" NOT NULL,
	"risk_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offer_mode" text NOT NULL,
	"product_url" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"offer_verified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"classification_confidence" numeric(5, 4) NOT NULL,
	"quarantine_reason" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"left_snapshot_id" uuid NOT NULL,
	"right_snapshot_id" uuid NOT NULL,
	"score" numeric(5, 4) NOT NULL,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sponsorship_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"label" text DEFAULT '赞助' NOT NULL,
	"destination_url" text NOT NULL,
	"image_url" text,
	"disclosure" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_metric_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"metric" text NOT NULL,
	"value" numeric(24, 6) NOT NULL,
	"unit" text NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sampled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_leases" ADD CONSTRAINT "crawl_leases_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_extraction_candidates" ADD CONSTRAINT "llm_extraction_candidates_raw_offer_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("raw_offer_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_feed_submissions" ADD CONSTRAINT "merchant_feed_submissions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_offer_snapshots" ADD CONSTRAINT "published_offer_snapshots_publish_generation_id_publish_generations_id_fk" FOREIGN KEY ("publish_generation_id") REFERENCES "public"."publish_generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_offer_snapshots" ADD CONSTRAINT "published_offer_snapshots_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_offer_snapshots" ADD CONSTRAINT "published_offer_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_offer_snapshots" ADD CONSTRAINT "published_offer_snapshots_canonical_product_id_canonical_products_id_fk" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."canonical_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_offer_snapshots" ADD CONSTRAINT "published_offer_snapshots_latest_raw_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("latest_raw_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_duplicate_candidates" ADD CONSTRAINT "semantic_duplicate_candidates_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_duplicate_candidates" ADD CONSTRAINT "semantic_duplicate_candidates_left_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("left_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_duplicate_candidates" ADD CONSTRAINT "semantic_duplicate_candidates_right_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("right_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_leases_hostname_uidx" ON "crawl_leases" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "discovery_runs_kind_started_idx" ON "discovery_runs" USING btree ("kind","started_at");--> statement-breakpoint
CREATE INDEX "error_events_service_time_idx" ON "error_events" USING btree ("service","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "llm_extraction_snapshot_model_prompt_uidx" ON "llm_extraction_candidates" USING btree ("raw_offer_snapshot_id","model","prompt_version");--> statement-breakpoint
CREATE INDEX "llm_extraction_status_idx" ON "llm_extraction_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchant_feed_submissions_status_idx" ON "merchant_feed_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchant_feed_submissions_fingerprint_idx" ON "merchant_feed_submissions" USING btree ("submitter_fingerprint","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "published_offer_snapshot_generation_identity_uidx" ON "published_offer_snapshots" USING btree ("publish_generation_id","source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "published_offer_snapshot_generation_rank_idx" ON "published_offer_snapshots" USING btree ("publish_generation_id","canonical_product_id","availability_state","price");--> statement-breakpoint
CREATE UNIQUE INDEX "semantic_duplicate_pair_uidx" ON "semantic_duplicate_candidates" USING btree ("left_snapshot_id","right_snapshot_id");--> statement-breakpoint
CREATE INDEX "semantic_duplicate_status_idx" ON "semantic_duplicate_candidates" USING btree ("status","score");--> statement-breakpoint
CREATE INDEX "sponsorship_active_idx" ON "sponsorship_placements" USING btree ("status","position","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "system_metric_service_metric_time_idx" ON "system_metric_samples" USING btree ("service","metric","sampled_at");