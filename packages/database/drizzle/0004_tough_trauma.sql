ALTER TABLE "source_submissions" ADD COLUMN "primary_products" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "submitter_fingerprint" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "precheck_result" jsonb;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD CONSTRAINT "source_submissions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_submissions_fingerprint_idx" ON "source_submissions" USING btree ("submitter_fingerprint","created_at");