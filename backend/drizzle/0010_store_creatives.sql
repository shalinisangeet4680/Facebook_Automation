CREATE TYPE "public"."store_asset_kind" AS ENUM('screen', 'preview', 'screenshot', 'feature_graphic');--> statement-breakpoint
CREATE TYPE "public"."store_project_status" AS ENUM('draft', 'choosing', 'style_chosen', 'rendered');--> statement-breakpoint
CREATE TABLE "store_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "store_asset_kind" NOT NULL,
	"name" text NOT NULL,
	"style" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT '' NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "store_assets_variant_key" UNIQUE("project_id","kind","name","style","lang","size")
);
--> statement-breakpoint
CREATE TABLE "store_projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "store_project_status" DEFAULT 'draft' NOT NULL,
	"chosen_style" text,
	"chosen_languages" jsonb,
	"chosen_sizes" jsonb,
	"upload_token_hash" text,
	"upload_token_expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_projects_upload_token_hash_unique" UNIQUE("upload_token_hash"),
	CONSTRAINT "store_projects_workspace_slug_key" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
ALTER TABLE "store_assets" ADD CONSTRAINT "store_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_assets" ADD CONSTRAINT "store_assets_project_id_store_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."store_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_projects" ADD CONSTRAINT "store_projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_projects" ADD CONSTRAINT "store_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_projects_workspace_updated_idx" ON "store_projects" USING btree ("workspace_id","updated_at");