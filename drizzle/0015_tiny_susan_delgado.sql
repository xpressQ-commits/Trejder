ALTER TABLE "vehicle_listings" ADD COLUMN "equipment" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD COLUMN "other_equipment" varchar(500);--> statement-breakpoint
CREATE INDEX "vehicle_listings_equipment_gin_idx" ON "vehicle_listings" USING gin ("equipment");