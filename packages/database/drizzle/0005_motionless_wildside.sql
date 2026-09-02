ALTER TABLE "reports" ADD COLUMN "submitter_fingerprint" text;--> statement-breakpoint
CREATE INDEX "reports_fingerprint_idx" ON "reports" USING btree ("submitter_fingerprint","created_at");