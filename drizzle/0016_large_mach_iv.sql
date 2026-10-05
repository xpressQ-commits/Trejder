CREATE TYPE "public"."deal_status" AS ENUM('accepted', 'in_progress', 'completed');--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "status" "deal_status" DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "seller_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "buyer_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "completed_at" timestamp with time zone;