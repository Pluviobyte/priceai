CREATE TABLE "api_rate_limit_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_click_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"day" date NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_click_daily" ADD CONSTRAINT "outbound_click_daily_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_rate_limit_fingerprint_window_uidx" ON "api_rate_limit_windows" USING btree ("fingerprint","window_start");--> statement-breakpoint
CREATE INDEX "api_rate_limit_window_idx" ON "api_rate_limit_windows" USING btree ("window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_click_daily_offer_day_uidx" ON "outbound_click_daily" USING btree ("offer_id","day");--> statement-breakpoint
CREATE INDEX "outbound_click_daily_day_idx" ON "outbound_click_daily" USING btree ("day");