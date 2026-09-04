CREATE TABLE "site_announcement_settings" (
	"key" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"rotation_enabled" boolean DEFAULT true NOT NULL,
	"rotation_interval_seconds" integer DEFAULT 6 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"badge" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"action_label" text NOT NULL,
	"destination_url" text NOT NULL,
	"kind" text DEFAULT 'update' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "site_announcements_public_idx" ON "site_announcements" USING btree ("status","sort_order","updated_at");
--> statement-breakpoint
INSERT INTO "site_announcement_settings" ("key", "rotation_enabled", "rotation_interval_seconds")
VALUES ('global', true, 6)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "site_announcements" ("id", "badge", "title", "description", "action_label", "destination_url", "kind", "status", "sort_order")
VALUES
  ('9968526a-bc8a-4bd6-8723-5da43aad4b11', '社区开放', 'QQ 和微信交流群已开启', '交流比价信息与使用经验', '加入交流群', '/support?contact=community', 'community', 'active', 10),
  ('604bf313-1a82-48f7-9bb8-b326aeb7e218', '新服务', '中转站模型检测服务已上线', '自带密钥，快速验证模型列表与连通性', '立即检测', '/api-transit/detector', 'service', 'active', 20)
ON CONFLICT ("id") DO NOTHING;
