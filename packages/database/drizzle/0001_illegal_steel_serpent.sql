CREATE TABLE "publication_channels" (
	"channel" text PRIMARY KEY NOT NULL,
	"current_generation_id" uuid,
	"previous_generation_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publication_channels" ADD CONSTRAINT "publication_channels_current_generation_id_publish_generations_id_fk" FOREIGN KEY ("current_generation_id") REFERENCES "public"."publish_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_channels" ADD CONSTRAINT "publication_channels_previous_generation_id_publish_generations_id_fk" FOREIGN KEY ("previous_generation_id") REFERENCES "public"."publish_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_attributes_match_uidx" ON "offer_attributes" USING btree ("offer_match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_matches_snapshot_uidx" ON "offer_matches" USING btree ("raw_offer_snapshot_id");