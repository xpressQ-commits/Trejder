ALTER TYPE "public"."bid_status" ADD VALUE 'expired';--> statement-breakpoint
DROP INDEX "bids_listing_bidder_uq";--> statement-breakpoint
ALTER TABLE "vehicle_listings" ALTER COLUMN "publication_duration_hours" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "publication_round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_platform_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "publication_round" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "vehicle_listings" SET "publication_round" = 1 WHERE "status" <> 'draft';--> statement-breakpoint
UPDATE "companies" SET "is_platform_owner" = true WHERE "kind" = 'dealer' AND regexp_replace("organization_number", '[^0-9]', '', 'g') = '5594293390';--> statement-breakpoint
CREATE UNIQUE INDEX "bids_listing_bidder_round_uq" ON "bids" USING btree ("listing_id","bidder_company_id","publication_round");--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_publication_round_positive" CHECK ("bids"."publication_round" > 0);--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_publication_round_nonnegative" CHECK ("vehicle_listings"."publication_round" >= 0);
