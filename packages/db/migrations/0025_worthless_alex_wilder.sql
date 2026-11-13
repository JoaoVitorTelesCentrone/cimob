CREATE TABLE "unit_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"code" text NOT NULL,
	"floor" integer,
	"area_m2" numeric(8, 2),
	"bedrooms" integer,
	"parking" integer,
	"price" numeric(14, 2),
	"status" "unit_status",
	"needs_review" boolean DEFAULT false NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unit_import_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "unit_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unit_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unit_import_rows" ADD CONSTRAINT "unit_import_rows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_import_rows" ADD CONSTRAINT "unit_import_rows_import_id_unit_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."unit_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_imports" ADD CONSTRAINT "unit_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;