CREATE TABLE "official_storefronts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"country_code" text NOT NULL,
	"storefront" text,
	"currency" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"detail" text,
	"last_checked_at" timestamp with time zone,
	"last_available_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "official_subscription_checks" ADD COLUMN "http_status" integer;--> statement-breakpoint
ALTER TABLE "official_subscription_checks" ADD COLUMN "final_url" text;--> statement-breakpoint
ALTER TABLE "official_subscription_checks" ADD COLUMN "parsed_count" integer;--> statement-breakpoint
ALTER TABLE "official_subscription_checks" ADD COLUMN "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "official_storefronts_source_country_uidx" ON "official_storefronts" USING btree ("source","country_code");--> statement-breakpoint
CREATE INDEX "official_storefronts_source_status_idx" ON "official_storefronts" USING btree ("source","status");