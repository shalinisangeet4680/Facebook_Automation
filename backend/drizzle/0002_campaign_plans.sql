CREATE TYPE "public"."campaign_plan_status" AS ENUM('draft', 'created', 'launched', 'discarded');--> statement-breakpoint
CREATE TABLE "campaign_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"source" text NOT NULL,
	"status" "campaign_plan_status" DEFAULT 'draft' NOT NULL,
	"plan" jsonb NOT NULL,
	"meta" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_plans" ADD CONSTRAINT "campaign_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_plans" ADD CONSTRAINT "campaign_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_plans_workspace_created_idx" ON "campaign_plans" USING btree ("workspace_id","created_at");