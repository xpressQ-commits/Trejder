ALTER TYPE "public"."membership_status" ADD VALUE 'revoked';--> statement-breakpoint
ALTER TABLE "company_invitations" ALTER COLUMN "invited_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "company_invitations_one_pending_email_uq" ON "company_invitations" USING btree ("company_id",lower("email")) WHERE "company_invitations"."status" = 'pending';