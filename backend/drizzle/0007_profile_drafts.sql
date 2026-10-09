CREATE TABLE "profile_drafts" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"facebook" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"instagram" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_drafts" ADD CONSTRAINT "profile_drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;