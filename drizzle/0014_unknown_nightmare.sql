ALTER TABLE "chat_messages" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "chat_messages_thread_read_idx" ON "chat_messages" USING btree ("thread_id","read_at");