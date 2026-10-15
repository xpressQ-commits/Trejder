CREATE TYPE "public"."listing_deviation" AS ENUM('WAS_WANTED', 'PRIVATE_IMPORT', 'MILEAGE_HISTORY_ANOMALY', 'REPAIRED');--> statement-breakpoint
CREATE TABLE "damage_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"object_key" text NOT NULL,
	"blurred_object_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"source_checksum_sha256" varchar(64) NOT NULL,
	"plate_redaction_status" "plate_redaction_status" DEFAULT 'NOT_CHECKED' NOT NULL,
	"plate_confidence" integer,
	"plate_processed_at" timestamp with time zone,
	"plate_processing_error" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "damage_images_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "damage_images_blurred_object_key_unique" UNIQUE("blurred_object_key"),
	CONSTRAINT "damage_images_position_range" CHECK ("damage_images"."position" BETWEEN 1 AND 5),
	CONSTRAINT "damage_images_plate_confidence_range" CHECK ("damage_images"."plate_confidence" IS NULL OR "damage_images"."plate_confidence" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "listing_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_name" varchar(200) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_documents_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD COLUMN "blurred_object_key" text;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "postal_code" varchar(5);--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "locality" varchar(120);--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "county" varchar(120);--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "deviations" "listing_deviation"[] DEFAULT '{}'::listing_deviation[] NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "wanted_comment" varchar(500);--> statement-breakpoint
ALTER TABLE "damage_images" ADD CONSTRAINT "damage_images_listing_id_vehicle_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_documents" ADD CONSTRAINT "listing_documents_listing_id_vehicle_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "damage_images_listing_position_uq" ON "damage_images" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_documents_listing_created_idx" ON "listing_documents" USING btree ("listing_id","created_at");--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_blurred_object_key_unique" UNIQUE("blurred_object_key");--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_location_complete" CHECK (("vehicle_listings"."postal_code" IS NULL AND "vehicle_listings"."locality" IS NULL AND "vehicle_listings"."county" IS NULL) OR ("vehicle_listings"."postal_code" IS NOT NULL AND "vehicle_listings"."locality" IS NOT NULL AND "vehicle_listings"."county" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_wanted_comment_requires_flag" CHECK ("vehicle_listings"."wanted_comment" IS NULL OR 'WAS_WANTED' = ANY("vehicle_listings"."deviations"));