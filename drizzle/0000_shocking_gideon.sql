CREATE TYPE "public"."bid_status" AS ENUM('active', 'withdrawn', 'accepted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."listing_input_kind" AS ENUM('registration', 'model');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'matched', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('admin', 'trader', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"actor_company_id" uuid,
	"action" varchar(120) NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" text NOT NULL,
	"request_id" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"listing_seller_company_id" uuid NOT NULL,
	"bidder_company_id" uuid NOT NULL,
	"placed_by_user_id" text NOT NULL,
	"anonymous_number" integer NOT NULL,
	"amount_ore" integer NOT NULL,
	"status" "bid_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_no_self_bid" CHECK ("bids"."listing_seller_company_id" <> "bids"."bidder_company_id"),
	CONSTRAINT "bids_amount_positive" CHECK ("bids"."amount_ore" > 0),
	CONSTRAINT "bids_alias_positive" CHECK ("bids"."anonymous_number" > 0),
	CONSTRAINT "bids_version_positive" CHECK ("bids"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"organization_number" varchar(20) NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"contact_phone" varchar(40),
	"status" "company_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_organization_number_unique" UNIQUE("organization_number")
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "membership_role" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "company_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"accepted_bid_id" uuid NOT NULL,
	"seller_company_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"accepted_by_user_id" text NOT NULL,
	"vehicle_amount_ore" integer NOT NULL,
	"seller_fee_ex_vat_ore" integer NOT NULL,
	"buyer_fee_ex_vat_ore" integer NOT NULL,
	"commercial_terms_version" varchar(80) NOT NULL,
	"currency" varchar(3) DEFAULT 'SEK' NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_listing_id_unique" UNIQUE("listing_id"),
	CONSTRAINT "matches_accepted_bid_id_unique" UNIQUE("accepted_bid_id"),
	CONSTRAINT "matches_distinct_parties" CHECK ("matches"."seller_company_id" <> "matches"."buyer_company_id"),
	CONSTRAINT "matches_vehicle_amount_positive" CHECK ("matches"."vehicle_amount_ore" > 0),
	CONSTRAINT "matches_seller_fee_nonnegative" CHECK ("matches"."seller_fee_ex_vat_ore" >= 0),
	CONSTRAINT "matches_buyer_fee_nonnegative" CHECK ("matches"."buyer_fee_ex_vat_ore" >= 0),
	CONSTRAINT "matches_currency_sek" CHECK ("matches"."currency" = 'SEK')
);
--> statement-breakpoint
CREATE TABLE "vehicle_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_images_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "vehicle_images_position_range" CHECK ("vehicle_images"."position" BETWEEN 1 AND 3),
	CONSTRAINT "vehicle_images_byte_size_positive" CHECK ("vehicle_images"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "vehicle_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_company_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"input_kind" "listing_input_kind" NOT NULL,
	"registration_number" varchar(16),
	"vehicle_model" varchar(160),
	"mileage_km" integer NOT NULL,
	"short_comment" varchar(500) NOT NULL,
	"deductible_vat" boolean NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_listings_mileage_nonnegative" CHECK ("vehicle_listings"."mileage_km" >= 0),
	CONSTRAINT "vehicle_listings_version_positive" CHECK ("vehicle_listings"."version" > 0),
	CONSTRAINT "vehicle_listings_identifier_matches_kind" CHECK (("vehicle_listings"."input_kind" = 'registration' AND "vehicle_listings"."registration_number" IS NOT NULL AND "vehicle_listings"."vehicle_model" IS NULL) OR ("vehicle_listings"."input_kind" = 'model' AND "vehicle_listings"."vehicle_model" IS NOT NULL AND "vehicle_listings"."registration_number" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_company_id_companies_id_fk" FOREIGN KEY ("actor_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_company_id_companies_id_fk" FOREIGN KEY ("bidder_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_placed_by_user_id_users_id_fk" FOREIGN KEY ("placed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_listing_and_seller_fk" FOREIGN KEY ("listing_id","listing_seller_company_id") REFERENCES "public"."vehicle_listings"("id","seller_company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_listing_id_vehicle_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_accepted_bid_id_bids_id_fk" FOREIGN KEY ("accepted_bid_id") REFERENCES "public"."bids"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_seller_company_id_companies_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_buyer_company_id_companies_id_fk" FOREIGN KEY ("buyer_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_listing_id_vehicle_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_seller_company_id_companies_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_logs_aggregate_idx" ON "audit_logs" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_company_idx" ON "audit_logs" USING btree ("actor_company_id");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_listing_bidder_uq" ON "bids" USING btree ("listing_id","bidder_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_listing_alias_uq" ON "bids" USING btree ("listing_id","anonymous_number");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_one_accepted_per_listing_uq" ON "bids" USING btree ("listing_id") WHERE "bids"."status" = 'accepted';--> statement-breakpoint
CREATE INDEX "company_invitations_company_email_idx" ON "company_invitations" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "company_memberships_company_user_uq" ON "company_memberships" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "company_memberships_user_idx" ON "company_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matches_seller_idx" ON "matches" USING btree ("seller_company_id");--> statement-breakpoint
CREATE INDEX "matches_buyer_idx" ON "matches" USING btree ("buyer_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_images_listing_position_uq" ON "vehicle_images" USING btree ("listing_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_listings_id_seller_uq" ON "vehicle_listings" USING btree ("id","seller_company_id");--> statement-breakpoint
CREATE INDEX "vehicle_listings_seller_status_idx" ON "vehicle_listings" USING btree ("seller_company_id","status");