ALTER TYPE "public"."bid_status" ADD VALUE 'rejected' BEFORE 'lost';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb;
