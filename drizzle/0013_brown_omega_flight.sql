ALTER TABLE "users" ADD COLUMN "theme_preference" varchar(10) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_locale" varchar(5) DEFAULT 'sv' NOT NULL;