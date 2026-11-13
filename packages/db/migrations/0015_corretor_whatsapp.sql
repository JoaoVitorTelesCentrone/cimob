ALTER TABLE "conversations" ADD COLUMN "agent_user_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_whatsapp_unique" UNIQUE("organization_id","whatsapp");