CREATE TYPE "public"."billing_override" AS ENUM('manual_block', 'manual_premium');--> statement-breakpoint
CREATE TYPE "public"."billing_sync_status" AS ENUM('synced', 'pending', 'syncing', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_billing_status" AS ENUM('none', 'active', 'past_due', 'unpaid', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."stripe_checkout_status" AS ENUM('open', 'complete', 'expired');--> statement-breakpoint
CREATE TABLE "company_subscriptions" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" varchar(120),
	"stripe_subscription_id" varchar(120),
	"stripe_extra_item_id" varchar(120),
	"stripe_status" "stripe_billing_status" DEFAULT 'none' NOT NULL,
	"stripe_last_event_created" integer DEFAULT 0 NOT NULL,
	"stripe_period_end" timestamp with time zone,
	"stripe_checkout_session_id" varchar(120),
	"stripe_checkout_session_url" text,
	"stripe_checkout_expires_at" timestamp with time zone,
	"stripe_checkout_status" "stripe_checkout_status",
	"stripe_checkout_generation" integer DEFAULT 0 NOT NULL,
	"free_access_starts_at" timestamp with time zone,
	"free_access_ends_at" timestamp with time zone,
	"free_granted_by_user_id" text,
	"free_granted_at" timestamp with time zone,
	"free_reason" varchar(500),
	"override" "billing_override",
	"override_reason" varchar(500),
	"override_by_user_id" text,
	"override_at" timestamp with time zone,
	"seat_sync_status" "billing_sync_status" DEFAULT 'synced' NOT NULL,
	"seat_sync_generation" integer DEFAULT 0 NOT NULL,
	"seat_sync_attempts" integer DEFAULT 0 NOT NULL,
	"last_synced_seat_quantity" integer DEFAULT 0 NOT NULL,
	"seat_sync_last_error" varchar(160),
	"seat_sync_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "company_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "company_subscriptions_free_window" CHECK ("company_subscriptions"."free_access_ends_at" IS NULL OR ("company_subscriptions"."free_access_starts_at" IS NOT NULL AND "company_subscriptions"."free_access_ends_at" > "company_subscriptions"."free_access_starts_at")),
	CONSTRAINT "company_subscriptions_sync_attempts_nonnegative" CHECK ("company_subscriptions"."seat_sync_attempts" >= 0),
	CONSTRAINT "company_subscriptions_sync_generation_nonnegative" CHECK ("company_subscriptions"."seat_sync_generation" >= 0),
	CONSTRAINT "company_subscriptions_event_created_nonnegative" CHECK ("company_subscriptions"."stripe_last_event_created" >= 0),
	CONSTRAINT "company_subscriptions_checkout_generation_nonnegative" CHECK ("company_subscriptions"."stripe_checkout_generation" >= 0),
	CONSTRAINT "company_subscriptions_seat_quantity_nonnegative" CHECK ("company_subscriptions"."last_synced_seat_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "processed_stripe_events" (
	"event_id" varchar(255) PRIMARY KEY NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_free_granted_by_user_id_users_id_fk" FOREIGN KEY ("free_granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_override_by_user_id_users_id_fk" FOREIGN KEY ("override_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_subscriptions_sync_idx" ON "company_subscriptions" USING btree ("seat_sync_status","seat_sync_updated_at");