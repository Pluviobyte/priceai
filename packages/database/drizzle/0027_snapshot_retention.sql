-- Metadata-only changes to the small generation table; fail promptly rather than queue behind production.
SET LOCAL lock_timeout = '500ms';
--> statement-breakpoint
SET LOCAL statement_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "snapshot_state" text DEFAULT 'retained' NOT NULL;--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "snapshot_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "added_count" integer;--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "removed_count" integer;--> statement-breakpoint
ALTER TABLE "publish_generations" ADD COLUMN "changed_count" integer;
--> statement-breakpoint
SET LOCAL lock_timeout = DEFAULT;
--> statement-breakpoint
SET LOCAL statement_timeout = DEFAULT;
