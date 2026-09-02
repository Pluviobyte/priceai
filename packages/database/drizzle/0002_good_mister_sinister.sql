CREATE TABLE "offer_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_offer_snapshot_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"offer_id" uuid,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"observed_value" jsonb,
	"baseline_value" jsonb,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "offer_anomalies" ADD CONSTRAINT "offer_anomalies_raw_offer_snapshot_id_raw_offer_snapshots_id_fk" FOREIGN KEY ("raw_offer_snapshot_id") REFERENCES "public"."raw_offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_anomalies" ADD CONSTRAINT "offer_anomalies_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_anomalies" ADD CONSTRAINT "offer_anomalies_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_anomalies_snapshot_kind_uidx" ON "offer_anomalies" USING btree ("raw_offer_snapshot_id","kind");--> statement-breakpoint
CREATE INDEX "offer_anomalies_status_idx" ON "offer_anomalies" USING btree ("status","severity");