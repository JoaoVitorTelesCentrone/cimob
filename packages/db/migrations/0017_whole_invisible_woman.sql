CREATE TABLE "ad_spend_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"ad_id" text NOT NULL,
	"campaign_id" text,
	"spend" numeric(14, 2) NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_spend_daily_org_date_ad_unique" UNIQUE("organization_id","date","ad_id")
);
--> statement-breakpoint
ALTER TABLE "ad_spend_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_ads_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ad_account_id" text NOT NULL,
	"token_secret_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_ads_accounts_ad_account_id_unique" UNIQUE("ad_account_id")
);
--> statement-breakpoint
ALTER TABLE "meta_ads_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_spend_daily" ADD CONSTRAINT "ad_spend_daily_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_ads_accounts" ADD CONSTRAINT "meta_ads_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;