CREATE TABLE "official_subscription_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_code" text NOT NULL,
	"vendor" text NOT NULL,
	"channel" text NOT NULL,
	"country_code" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"evidence_url" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "official_subscription_checks_identity_uidx" ON "official_subscription_checks" USING btree ("vendor","plan_code","channel","country_code");