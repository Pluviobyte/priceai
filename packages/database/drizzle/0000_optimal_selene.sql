CREATE TYPE "public"."availability_state" AS ENUM('purchasable', 'unavailable', 'quarantined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."commercial_relation" AS ENUM('none', 'affiliate', 'sponsor', 'merchant_direct', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."crawl_run_status" AS ENUM('queued', 'running', 'success', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."freshness_state" AS ENUM('fresh', 'aging', 'stale', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source_health" AS ENUM('healthy', 'retrying', 'failing', 'paused', 'removed');--> statement-breakpoint
CREATE TYPE "public"."stock_state" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'unknown', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'prechecked', 'trial_crawled', 'review', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"plan_family" text NOT NULL,
	"billing_period" text,
	"base_duration_days" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"official_product_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"collector_kind" text NOT NULL,
	"collector_version" text NOT NULL,
	"status" "crawl_run_status" DEFAULT 'queued' NOT NULL,
	"complete_snapshot" boolean DEFAULT false NOT NULL,
	"expected_total" integer,
	"fetched_total" integer DEFAULT 0 NOT NULL,
	"parsed_total" integer DEFAULT 0 NOT NULL,
	"duplicate_total" integer DEFAULT 0 NOT NULL,
	"quarantined_total" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"http_status_summary" jsonb,
	"error_code" text,
	"error_message" text,
	"raw_manifest_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"override_kind" text NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website_url" text,
	"contact_public" jsonb,
	"commercial_relation" "commercial_relation" DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_match_id" uuid NOT NULL,
	"offer_mode" text NOT NULL,
	"duration_days" integer,
	"region" text,
	"account_ownership" text DEFAULT 'unknown' NOT NULL,
	"phone_bound" boolean,
	"email_type" text,
	"warranty_type" text DEFAULT 'unknown' NOT NULL,
	"warranty_hours" integer,
	"auto_delivery" boolean,
	"web_available" boolean,
	"desktop_available" boolean,
	"api_available" boolean,
	"shared" boolean,
	"invoice_available" boolean,
	"refund_policy" text,
	"risk_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attribute_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_offer_snapshot_id" uuid NOT NULL,
	"canonical_product_id" uuid,
	"confidence" numeric(5, 4) NOT NULL,
	"matched_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflicting_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classifier_version" text NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"manual_override_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"price" numeric(20, 6) NOT NULL,
	"currency" text NOT NULL,
	"stock_count" integer,
	"stock_state" "stock_state" NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crawl_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"offer_verified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"classification_confidence" numeric(5, 4) NOT NULL,
	"quarantine_reason" text,
	"publish_generation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'staging' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"offer_count" integer DEFAULT 0 NOT NULL,
	"product_count" integer DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"manifest_url" text,
	"previous_generation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "raw_offer_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_item_id" text NOT NULL,
	"raw_title" text NOT NULL,
	"raw_description" text,
	"raw_category" text,
	"raw_price_text" text NOT NULL,
	"raw_price_numeric" numeric(20, 6),
	"currency" text NOT NULL,
	"raw_stock" jsonb,
	"stock_count" integer,
	"stock_state_hint" "stock_state" DEFAULT 'unknown' NOT NULL,
	"product_url" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"captured_at" timestamp with time zone NOT NULL,
	"raw_payload_url" text,
	"raw_payload_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"details" text,
	"evidence_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "source_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_url" text NOT NULL,
	"merchant_name_hint" text,
	"platform_hint" text,
	"discovery_kind" text NOT NULL,
	"discovery_url" text,
	"submitted_by" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "source_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"contact" text,
	"notes" text,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"detected_collector_kind" text,
	"trial_run_id" uuid,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid,
	"platform_kind" text NOT NULL,
	"platform_merchant_id" text NOT NULL,
	"shop_token" text,
	"canonical_entry_url" text NOT NULL,
	"submitted_url" text,
	"collector_kind" text NOT NULL,
	"collector_config_encrypted" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"health_status" "source_health" DEFAULT 'paused' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"expected_product_count" integer,
	"latest_complete_run_id" uuid,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_attributes" ADD CONSTRAINT "offer_attributes_offer_match_id_offer_matches_id_fk" FOREIGN KEY ("offer_match_id") REFERENCES "public"."offer_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_matches" ADD CONSTRAINT "offer_matches_raw_offer_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("raw_offer_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_matches" ADD CONSTRAINT "offer_matches_canonical_product_id_canonical_products_id_fk" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."canonical_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_matches" ADD CONSTRAINT "offer_matches_manual_override_id_manual_overrides_id_fk" FOREIGN KEY ("manual_override_id") REFERENCES "public"."manual_overrides"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_price_history" ADD CONSTRAINT "offer_price_history_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_price_history" ADD CONSTRAINT "offer_price_history_crawl_run_id_crawl_runs_id_fk" FOREIGN KEY ("crawl_run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_canonical_product_id_canonical_products_id_fk" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."canonical_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_latest_raw_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("latest_raw_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_publish_generation_id_publish_generations_id_fk" FOREIGN KEY ("publish_generation_id") REFERENCES "public"."publish_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_offer_snapshots" ADD CONSTRAINT "raw_offer_snapshots_crawl_run_id_crawl_runs_id_fk" FOREIGN KEY ("crawl_run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_offer_snapshots" ADD CONSTRAINT "raw_offer_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_products_slug_uidx" ON "canonical_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "canonical_products_brand_idx" ON "canonical_products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "crawl_runs_source_created_idx" ON "crawl_runs" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "crawl_runs_status_idx" ON "crawl_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_uidx" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "offer_matches_product_idx" ON "offer_matches" USING btree ("canonical_product_id");--> statement-breakpoint
CREATE INDEX "offer_matches_review_idx" ON "offer_matches" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "offer_price_history_offer_idx" ON "offer_price_history" USING btree ("offer_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_source_item_uidx" ON "offers" USING btree ("source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "offers_product_rank_idx" ON "offers" USING btree ("canonical_product_id","availability_state","freshness_state","price");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_offer_run_source_item_uidx" ON "raw_offer_snapshots" USING btree ("crawl_run_id","source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "raw_offer_source_item_idx" ON "raw_offer_snapshots" USING btree ("source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_candidates_status_idx" ON "source_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_submissions_status_idx" ON "source_submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_platform_identity_uidx" ON "sources" USING btree ("platform_kind","platform_merchant_id");--> statement-breakpoint
CREATE INDEX "sources_scheduler_idx" ON "sources" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "sources_health_idx" ON "sources" USING btree ("health_status");