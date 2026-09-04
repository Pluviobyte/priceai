ALTER TABLE "site_announcement_settings" ALTER COLUMN "rotation_interval_seconds" SET DEFAULT 4;
--> statement-breakpoint
UPDATE "site_announcement_settings"
SET "rotation_interval_seconds" = 4,
    "updated_at" = now()
WHERE "key" = 'global'
  AND "rotation_interval_seconds" = 6;
