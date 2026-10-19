CREATE TYPE "public"."meta_lead_form_source" AS ENUM('created', 'discovered');--> statement-breakpoint
CREATE TYPE "public"."meta_lead_status" AS ENUM('new', 'contacted', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "meta_lead_forms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" text NOT NULL,
	"page_id" text NOT NULL,
	"name" text NOT NULL,
	"source" "meta_lead_form_source" NOT NULL,
	"plan_id" uuid,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_lead_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_lead_syncs" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"error_code" text,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" text NOT NULL,
	"form_id" text NOT NULL,
	"ad_id" text,
	"ad_name" text,
	"adset_id" text,
	"adset_name" text,
	"campaign_id" text,
	"campaign_name" text,
	"created_time" timestamp with time zone NOT NULL,
	"field_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "meta_lead_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_workspace_settings" ADD COLUMN "notify_new_leads" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_lead_forms" ADD CONSTRAINT "meta_lead_forms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_lead_forms" ADD CONSTRAINT "meta_lead_forms_plan_id_campaign_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."campaign_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_lead_syncs" ADD CONSTRAINT "meta_lead_syncs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_leads" ADD CONSTRAINT "meta_leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meta_lead_forms_workspace_form_uq" ON "meta_lead_forms" USING btree ("workspace_id","form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_leads_workspace_lead_uq" ON "meta_leads" USING btree ("workspace_id","lead_id");--> statement-breakpoint
CREATE INDEX "meta_leads_workspace_created_idx" ON "meta_leads" USING btree ("workspace_id","created_time");--> statement-breakpoint
CREATE INDEX "meta_leads_workspace_status_idx" ON "meta_leads" USING btree ("workspace_id","status");