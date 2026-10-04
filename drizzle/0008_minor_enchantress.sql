ALTER TABLE "vehicle_listings" ADD COLUMN IF NOT EXISTS "model_year" integer;--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_model_year_range" CHECK ("vehicle_listings"."model_year" IS NULL OR "vehicle_listings"."model_year" BETWEEN 1950 AND 3000);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_company_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_body_not_blank" CHECK (length(btrim("chat_messages"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"seller_company_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"anonymous_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_threads_distinct_parties" CHECK ("chat_threads"."seller_company_id" <> "chat_threads"."buyer_company_id"),
	CONSTRAINT "chat_threads_alias_positive" CHECK ("chat_threads"."anonymous_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_company_id_companies_id_fk" FOREIGN KEY ("sender_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_seller_company_id_companies_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_buyer_company_id_companies_id_fk" FOREIGN KEY ("buyer_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_listing_and_seller_fk" FOREIGN KEY ("listing_id","seller_company_id") REFERENCES "public"."vehicle_listings"("id","seller_company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_thread_created_idx" ON "chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_listing_buyer_uq" ON "chat_threads" USING btree ("listing_id","buyer_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_listing_alias_uq" ON "chat_threads" USING btree ("listing_id","anonymous_number");--> statement-breakpoint
CREATE INDEX "chat_threads_seller_updated_idx" ON "chat_threads" USING btree ("seller_company_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_threads_buyer_updated_idx" ON "chat_threads" USING btree ("buyer_company_id","updated_at");
