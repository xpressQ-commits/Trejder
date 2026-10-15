ALTER TABLE "vehicle_listings" DROP CONSTRAINT "vehicle_listings_identifier_matches_kind";--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "show_registration_number" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_identifier_matches_kind" CHECK (("vehicle_listings"."input_kind" = 'registration' AND "vehicle_listings"."registration_number" IS NOT NULL) OR ("vehicle_listings"."input_kind" = 'model' AND "vehicle_listings"."vehicle_model" IS NOT NULL));
