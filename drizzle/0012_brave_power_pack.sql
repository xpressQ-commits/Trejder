CREATE TYPE "public"."company_kind" AS ENUM('dealer', 'private');--> statement-breakpoint
CREATE TYPE "public"."listing_question_status" AS ENUM('published', 'hidden', 'removed');--> statement-breakpoint
ALTER TYPE "public"."membership_role" ADD VALUE 'private_customer';--> statement-breakpoint
CREATE TABLE "listing_participant_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"anonymous_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_participant_alias_number_positive" CHECK ("listing_participant_aliases"."anonymous_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "listing_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"author_company_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"body" varchar(1000) NOT NULL,
	"status" "listing_question_status" DEFAULT 'published' NOT NULL,
	"moderation_reason" varchar(200),
	"answer_body" varchar(1000),
	"answered_by_user_id" text,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_questions_body_not_blank" CHECK (length(btrim("listing_questions"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" text NOT NULL,
	"type" varchar(80) NOT NULL,
	"body" varchar(240) NOT NULL,
	"resource_type" varchar(40) NOT NULL,
	"resource_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "private_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"password_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_registrations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "bid_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "kind" "company_kind" DEFAULT 'dealer' NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_participant_aliases" ADD CONSTRAINT "listing_participant_aliases_listing_id_vehicle_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_participant_aliases" ADD CONSTRAINT "listing_participant_aliases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_questions" ADD CONSTRAINT "listing_questions_listing_id_vehicle_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_questions" ADD CONSTRAINT "listing_questions_author_company_id_companies_id_fk" FOREIGN KEY ("author_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_questions" ADD CONSTRAINT "listing_questions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_questions" ADD CONSTRAINT "listing_questions_answered_by_user_id_users_id_fk" FOREIGN KEY ("answered_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_participant_alias_company_uq" ON "listing_participant_aliases" USING btree ("listing_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_participant_alias_number_uq" ON "listing_participant_aliases" USING btree ("listing_id","anonymous_number");--> statement-breakpoint
CREATE INDEX "listing_questions_listing_created_idx" ON "listing_questions" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "private_registrations_pending_email_uq" ON "private_registrations" USING btree (lower("email")) WHERE "private_registrations"."consumed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_bid_uq" ON "chat_threads" USING btree ("bid_id");