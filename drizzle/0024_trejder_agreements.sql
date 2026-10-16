CREATE TYPE "public"."agreement_direction" AS ENUM('company_buys', 'company_sells');--> statement-breakpoint
CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'generated', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agreement_vat_mode" AS ENUM('deductible', 'margin_scheme');--> statement-breakpoint
CREATE SEQUENCE "public"."trejder_agreement_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_number" varchar(40) NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"deal_id" uuid,
	"direction" "agreement_direction" NOT NULL,
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"agreement_date" date NOT NULL,
	"company_snapshot" jsonb NOT NULL,
	"counterparty_snapshot" jsonb NOT NULL,
	"vehicle_snapshot" jsonb NOT NULL,
	"vat_mode" "agreement_vat_mode" NOT NULL,
	"total_amount_ore" integer NOT NULL,
	"net_amount_ore" integer,
	"vat_amount_ore" integer,
	"finance_allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_details" jsonb NOT NULL,
	"handover_snapshot" jsonb NOT NULL,
	"additional_terms" varchar(5000) DEFAULT '' NOT NULL,
	"terms_version" varchar(80) NOT NULL,
	"pdf_object_key" text,
	"pdf_checksum_sha256" varchar(64),
	"pdf_byte_size" integer,
	"pdf_version" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreements_agreement_number_unique" UNIQUE("agreement_number"),
	CONSTRAINT "agreements_pdf_object_key_unique" UNIQUE("pdf_object_key"),
	CONSTRAINT "agreements_total_positive" CHECK ("agreements"."total_amount_ore" > 0),
	CONSTRAINT "agreements_net_nonnegative" CHECK ("agreements"."net_amount_ore" IS NULL OR "agreements"."net_amount_ore" >= 0),
	CONSTRAINT "agreements_vat_nonnegative" CHECK ("agreements"."vat_amount_ore" IS NULL OR "agreements"."vat_amount_ore" >= 0),
	CONSTRAINT "agreements_version_positive" CHECK ("agreements"."version" > 0),
	CONSTRAINT "agreements_pdf_version_nonnegative" CHECK ("agreements"."pdf_version" >= 0),
	CONSTRAINT "agreements_currency_shape" CHECK ("agreements"."vat_mode" <> 'deductible' OR ("agreements"."net_amount_ore" IS NOT NULL AND "agreements"."vat_amount_ore" IS NOT NULL AND "agreements"."net_amount_ore" + "agreements"."vat_amount_ore" = "agreements"."total_amount_ore")),
	CONSTRAINT "agreements_margin_vat_hidden" CHECK ("agreements"."vat_mode" <> 'margin_scheme' OR ("agreements"."net_amount_ore" IS NULL AND "agreements"."vat_amount_ore" IS NULL)),
	CONSTRAINT "agreements_generated_pdf" CHECK ("agreements"."status" NOT IN ('generated', 'completed') OR ("agreements"."pdf_object_key" IS NOT NULL AND "agreements"."pdf_checksum_sha256" IS NOT NULL AND "agreements"."generated_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_line_1" varchar(240);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "postal_code" varchar(12);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" varchar(120);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "vat_number" varchar(32);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_object_key" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_mime_type" varchar(40);--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_deal_id_matches_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_company_number_uq" ON "agreements" USING btree ("company_id","agreement_number");--> statement-breakpoint
CREATE INDEX "agreements_company_status_created_idx" ON "agreements" USING btree ("company_id","status","created_at");--> statement-breakpoint
CREATE INDEX "agreements_deal_idx" ON "agreements" USING btree ("deal_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_object_key_unique" UNIQUE("logo_object_key");
