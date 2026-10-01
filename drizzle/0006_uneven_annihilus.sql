CREATE TYPE "public"."plate_redaction_status" AS ENUM('NOT_CHECKED', 'PROCESSING', 'NO_PLATE_DETECTED', 'PLATE_REDACTED', 'REVIEW_REQUIRED', 'FAILED');--> statement-breakpoint
ALTER TABLE "vehicle_images" DROP CONSTRAINT "vehicle_images_position_range";--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD COLUMN "source_checksum_sha256" varchar(64);--> statement-breakpoint
UPDATE "vehicle_images" SET "source_checksum_sha256" = "checksum_sha256";--> statement-breakpoint
ALTER TABLE "vehicle_images" ALTER COLUMN "source_checksum_sha256" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD COLUMN "plate_redaction_status" "plate_redaction_status" DEFAULT 'NOT_CHECKED' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD COLUMN "plate_confidence" integer;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD COLUMN "plate_processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD COLUMN "plate_processing_error" varchar(120);--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_plate_confidence_range" CHECK ("vehicle_images"."plate_confidence" IS NULL OR "vehicle_images"."plate_confidence" BETWEEN 0 AND 1000);--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_position_range" CHECK ("vehicle_images"."position" BETWEEN 1 AND 5);
