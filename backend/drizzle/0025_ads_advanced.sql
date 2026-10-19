CREATE TABLE "ad_audiences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"targeting" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_plans" ADD COLUMN "ad_account_id" text;--> statement-breakpoint
ALTER TABLE "ad_audiences" ADD CONSTRAINT "ad_audiences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_audiences" ADD CONSTRAINT "ad_audiences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_audiences_workspace_name_uq" ON "ad_audiences" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "ad_audiences_workspace_updated_idx" ON "ad_audiences" USING btree ("workspace_id","updated_at");