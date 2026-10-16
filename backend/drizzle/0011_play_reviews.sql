CREATE TYPE "public"."play_connection_status" AS ENUM('active', 'error');--> statement-breakpoint
CREATE TYPE "public"."play_reply_source" AS ENUM('template', 'claude', 'manual');--> statement-breakpoint
CREATE TYPE "public"."play_reply_status" AS ENUM('pending_approval', 'needs_claude', 'scheduled', 'sent', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."play_rule_mode" AS ENUM('approval', 'auto');--> statement-breakpoint
CREATE TYPE "public"."play_template_category" AS ENUM('positive', 'negative', 'bug', 'feature', 'billing', 'updated', 'neutral', 'custom');--> statement-breakpoint
CREATE TABLE "play_apps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"package_name" text NOT NULL,
	"title" text NOT NULL,
	"icon_url" text,
	"automation" boolean DEFAULT false NOT NULL,
	"settings" jsonb NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latest_version" text,
	"last_synced_at" timestamp with time zone,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_apps_workspace_package_key" UNIQUE("workspace_id","package_name")
);
--> statement-breakpoint
CREATE TABLE "play_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_email" text NOT NULL,
	"project_id" text NOT NULL,
	"key_ciphertext" text NOT NULL,
	"status" "play_connection_status" DEFAULT 'active' NOT NULL,
	"error" text,
	"checked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_connections_workspace_email_key" UNIQUE("workspace_id","client_email")
);
--> statement-breakpoint
CREATE TABLE "play_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"source" "play_reply_source" NOT NULL,
	"template_id" uuid,
	"rule_id" uuid,
	"status" "play_reply_status" NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"note" text,
	"send_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_by" uuid,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"review_id" text NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"stars" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"original_text" text,
	"language" text,
	"app_version_name" text,
	"app_version_code" integer,
	"device" text,
	"android_version" integer,
	"thumbs_up" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"edited_after_reply" boolean DEFAULT false NOT NULL,
	"stars_before_edit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_reviews_app_review_key" UNIQUE("app_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "play_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"conditions" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"mode" "play_rule_mode" DEFAULT 'approval' NOT NULL,
	"delay_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid,
	"name" text NOT NULL,
	"category" "play_template_category" NOT NULL,
	"bodies" jsonb NOT NULL,
	"preset_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_apps" ADD CONSTRAINT "play_apps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_apps" ADD CONSTRAINT "play_apps_connection_id_play_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."play_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_connections" ADD CONSTRAINT "play_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_connections" ADD CONSTRAINT "play_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_app_id_play_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."play_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_review_id_play_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."play_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_template_id_play_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."play_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_rule_id_play_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."play_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_replies" ADD CONSTRAINT "play_replies_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_reviews" ADD CONSTRAINT "play_reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_reviews" ADD CONSTRAINT "play_reviews_app_id_play_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."play_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_rules" ADD CONSTRAINT "play_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_rules" ADD CONSTRAINT "play_rules_app_id_play_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."play_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_templates" ADD CONSTRAINT "play_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_templates" ADD CONSTRAINT "play_templates_app_id_play_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."play_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "play_replies_active_review_uq" ON "play_replies" USING btree ("review_id") WHERE status in ('pending_approval', 'needs_claude', 'scheduled');--> statement-breakpoint
CREATE INDEX "play_replies_due_idx" ON "play_replies" USING btree ("status","send_at") WHERE status = 'scheduled';--> statement-breakpoint
CREATE INDEX "play_replies_app_status_idx" ON "play_replies" USING btree ("app_id","status");--> statement-breakpoint
CREATE INDEX "play_reviews_app_reviewed_idx" ON "play_reviews" USING btree ("app_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "play_rules_app_position_idx" ON "play_rules" USING btree ("app_id","position");--> statement-breakpoint
CREATE INDEX "play_templates_workspace_idx" ON "play_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "play_templates_workspace_preset_uq" ON "play_templates" USING btree ("workspace_id","preset_key") WHERE preset_key is not null and app_id is null;