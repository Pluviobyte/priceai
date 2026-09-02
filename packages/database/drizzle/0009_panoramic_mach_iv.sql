CREATE TABLE "exchange_rate_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"source_url" text NOT NULL,
	"source_name" text NOT NULL,
	"effective_date" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_api_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"model_code" text NOT NULL,
	"display_name" text NOT NULL,
	"modality" text NOT NULL,
	"context_window" integer,
	"availability" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_api_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"official_api_price_id" uuid NOT NULL,
	"input_price" numeric(20, 8),
	"cached_input_price" numeric(20, 8),
	"output_price" numeric(20, 8),
	"additional_prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_url" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_api_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"price_tier" text DEFAULT 'standard' NOT NULL,
	"unit" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"input_price" numeric(20, 8),
	"cached_input_price" numeric(20, 8),
	"output_price" numeric(20, 8),
	"additional_prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"free_tier" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rate_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_url" text NOT NULL,
	"document_version" text,
	"evidence_hash" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_api_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"pricing_url" text NOT NULL,
	"models_url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor" text NOT NULL,
	"plan_code" text NOT NULL,
	"display_name" text NOT NULL,
	"billing_period" text NOT NULL,
	"canonical_product_id" uuid,
	"official_url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_subscription_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"official_price_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"price_kind" text NOT NULL,
	"amount" numeric(20, 6),
	"lower_amount" numeric(20, 6),
	"upper_amount" numeric(20, 6),
	"cny_estimate" numeric(20, 6),
	"evidence_url" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_subscription_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"country_code" text NOT NULL,
	"currency" text NOT NULL,
	"price_kind" text NOT NULL,
	"amount" numeric(20, 6),
	"lower_amount" numeric(20, 6),
	"upper_amount" numeric(20, 6),
	"cny_estimate" numeric(20, 6),
	"exchange_rate_snapshot_id" uuid,
	"raw_plan_name" text NOT NULL,
	"app_id" text,
	"evidence_url" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_hash" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"evidence_url" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transit_model_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"model_code" text NOT NULL,
	"display_name" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"unit" text DEFAULT 'per_million_tokens' NOT NULL,
	"input_price" numeric(20, 8),
	"output_price" numeric(20, 8),
	"multiplier" numeric(12, 6),
	"fixed_plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_kind" text NOT NULL,
	"evidence_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transit_probes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"probe_kind" text NOT NULL,
	"success" boolean NOT NULL,
	"latency_ms" integer,
	"http_status" integer,
	"model_count" integer,
	"error_code" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transit_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"website_url" text NOT NULL,
	"api_base_url" text,
	"models_endpoint" text,
	"status_url" text,
	"operator_name" text,
	"system_kind" text DEFAULT 'unknown' NOT NULL,
	"discovery_source" text NOT NULL,
	"evidence_url" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "official_api_models" ADD CONSTRAINT "official_api_models_vendor_id_official_api_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."official_api_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_api_price_history" ADD CONSTRAINT "official_api_price_history_official_api_price_id_official_api_prices_id_fk" FOREIGN KEY ("official_api_price_id") REFERENCES "public"."official_api_prices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_api_prices" ADD CONSTRAINT "official_api_prices_model_id_official_api_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."official_api_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_subscription_plans" ADD CONSTRAINT "official_subscription_plans_canonical_product_id_canonical_products_id_fk" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."canonical_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_subscription_price_history" ADD CONSTRAINT "official_subscription_price_history_official_price_id_official_subscription_prices_id_fk" FOREIGN KEY ("official_price_id") REFERENCES "public"."official_subscription_prices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_subscription_prices" ADD CONSTRAINT "official_subscription_prices_plan_id_official_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."official_subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_subscription_prices" ADD CONSTRAINT "official_subscription_prices_exchange_rate_snapshot_id_exchange_rate_snapshots_id_fk" FOREIGN KEY ("exchange_rate_snapshot_id") REFERENCES "public"."exchange_rate_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transit_events" ADD CONSTRAINT "transit_events_provider_id_transit_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."transit_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transit_model_prices" ADD CONSTRAINT "transit_model_prices_provider_id_transit_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."transit_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transit_probes" ADD CONSTRAINT "transit_probes_provider_id_transit_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."transit_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_pair_date_uidx" ON "exchange_rate_snapshots" USING btree ("base_currency","quote_currency","effective_date");--> statement-breakpoint
CREATE INDEX "exchange_rate_latest_idx" ON "exchange_rate_snapshots" USING btree ("base_currency","quote_currency","effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "official_api_models_vendor_code_uidx" ON "official_api_models" USING btree ("vendor_id","model_code");--> statement-breakpoint
CREATE INDEX "official_api_models_vendor_idx" ON "official_api_models" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "official_api_history_price_idx" ON "official_api_price_history" USING btree ("official_api_price_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "official_api_price_model_tier_uidx" ON "official_api_prices" USING btree ("model_id","price_tier","unit");--> statement-breakpoint
CREATE INDEX "official_api_price_verified_idx" ON "official_api_prices" USING btree ("verified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "official_api_vendors_slug_uidx" ON "official_api_vendors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "official_subscription_plans_vendor_code_uidx" ON "official_subscription_plans" USING btree ("vendor","plan_code");--> statement-breakpoint
CREATE INDEX "official_subscription_plans_vendor_idx" ON "official_subscription_plans" USING btree ("vendor");--> statement-breakpoint
CREATE INDEX "official_subscription_history_price_idx" ON "official_subscription_price_history" USING btree ("official_price_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "official_subscription_price_identity_uidx" ON "official_subscription_prices" USING btree ("plan_id","channel","country_code","raw_plan_name");--> statement-breakpoint
CREATE INDEX "official_subscription_price_rank_idx" ON "official_subscription_prices" USING btree ("plan_id","price_kind","cny_estimate");--> statement-breakpoint
CREATE INDEX "transit_events_provider_started_idx" ON "transit_events" USING btree ("provider_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transit_model_price_provider_model_uidx" ON "transit_model_prices" USING btree ("provider_id","model_code");--> statement-breakpoint
CREATE INDEX "transit_probes_provider_checked_idx" ON "transit_probes" USING btree ("provider_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transit_providers_slug_uidx" ON "transit_providers" USING btree ("slug");