CREATE TABLE "account_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_key" text NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_profiles" (
	"owner_key" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_feed_submissions" ADD COLUMN "account_owner_key" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "account_owner_key" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "account_owner_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "account_favorites_owner_target_uidx" ON "account_favorites" USING btree ("owner_key","kind","slug");