ALTER TABLE "crawl_leases" ADD COLUMN "platform_kind" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "crawl_leases" ADD COLUMN "platform_slot" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_leases_platform_slot_uidx" ON "crawl_leases" USING btree ("platform_kind","platform_slot");--> statement-breakpoint
CREATE INDEX "offers_generation_product_rank_idx" ON "offers" USING btree ("publish_generation_id","canonical_product_id","availability_state","price");