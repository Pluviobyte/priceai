CREATE TABLE "site_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"contact" text NOT NULL,
	"message" text NOT NULL,
	"submitter_fingerprint" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "site_inquiries_created_idx" ON "site_inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "site_inquiries_fingerprint_idx" ON "site_inquiries" USING btree ("submitter_fingerprint","created_at");