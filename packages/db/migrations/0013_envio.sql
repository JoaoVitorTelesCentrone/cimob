CREATE TYPE "public"."message_send_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "phone_number_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "send_status" "message_send_status";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "send_error" text;