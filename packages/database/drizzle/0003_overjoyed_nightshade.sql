CREATE TABLE "classification_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_item_id" text NOT NULL,
	"canonical_product_id" uuid,
	"decision" text NOT NULL,
	"attribute_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classification_overrides" ADD CONSTRAINT "classification_overrides_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_overrides" ADD CONSTRAINT "classification_overrides_canonical_product_id_canonical_products_id_fk" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."canonical_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classification_overrides_source_item_uidx" ON "classification_overrides" USING btree ("source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "classification_overrides_active_idx" ON "classification_overrides" USING btree ("active");