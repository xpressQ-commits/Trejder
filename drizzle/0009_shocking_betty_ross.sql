ALTER TABLE "vehicle_listings" ADD COLUMN "publication_duration_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "vehicle_listings"
SET "expires_at" = NOW() + INTERVAL '120 hours'
WHERE "status" = 'active' AND "published_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_publication_duration_range" CHECK ("vehicle_listings"."publication_duration_hours" BETWEEN 48 AND 120);--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_expiry_after_publication" CHECK ("vehicle_listings"."expires_at" IS NULL OR ("vehicle_listings"."published_at" IS NOT NULL AND "vehicle_listings"."expires_at" > "vehicle_listings"."published_at"));
