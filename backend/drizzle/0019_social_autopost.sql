CREATE TYPE "public"."autopost_account_status" AS ENUM('active', 'error');--> statement-breakpoint
CREATE TYPE "public"."autopost_comment_class" AS ENUM('question', 'praise', 'complaint', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."autopost_content_type" AS ENUM('tip', 'offer', 'behind_the_scenes', 'testimonial', 'festival', 'product', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."autopost_format" AS ENUM('image', 'carousel', 'reel', 'story', 'multi_image', 'video', 'text', 'link');--> statement-breakpoint
CREATE TYPE "public"."autopost_login" AS ENUM('facebook', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."autopost_mode" AS ENUM('auto', 'approval', 'manual');--> statement-breakpoint
CREATE TYPE "public"."autopost_platform" AS ENUM('instagram', 'facebook');--> statement-breakpoint
CREATE TYPE "public"."autopost_reply_source" AS ENUM('template', 'claude', 'manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."autopost_reply_status" AS ENUM('pending_approval', 'needs_claude', 'scheduled', 'sent', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."autopost_status" AS ENUM('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid,
	"kit" jsonb NOT NULL,
	"prefilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_account_metrics" (
	"account_id" uuid NOT NULL,
	"day" date NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_account_metrics_account_id_day_pk" PRIMARY KEY("account_id","day")
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "autopost_platform" NOT NULL,
	"login" "autopost_login" NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"category" text,
	"page_id" text,
	"token_ciphertext" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"status" "autopost_account_status" DEFAULT 'active' NOT NULL,
	"error" text,
	"followers" integer DEFAULT 0 NOT NULL,
	"settings" jsonb NOT NULL,
	"best_times" jsonb,
	"comments_synced_at" timestamp with time zone,
	"metrics_synced_at" timestamp with time zone,
	"digest_sent_at" timestamp with time zone,
	"paused_until" timestamp with time zone,
	"pause_reason" text,
	"connected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_workspace_platform_external_key" UNIQUE("workspace_id","platform","external_id")
);
--> statement-breakpoint
CREATE TABLE "social_autoposts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"plan_id" uuid,
	"platform" "autopost_platform" NOT NULL,
	"format" "autopost_format" NOT NULL,
	"content_type" "autopost_content_type" NOT NULL,
	"idea" text,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_comment" text,
	"alt_text" text,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"link" text,
	"location" text,
	"collaborators" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "autopost_status" NOT NULL,
	"mode" "autopost_mode" DEFAULT 'approval' NOT NULL,
	"held_reason" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"external_id" text,
	"permalink" text,
	"first_comment_id" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'app' NOT NULL,
	"ai_written" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_comment_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"source" "autopost_reply_source" NOT NULL,
	"status" "autopost_reply_status" NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"note" text,
	"send_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"external_id" text,
	"error" text,
	"created_by" uuid,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"post_id" uuid,
	"external_post_id" text NOT NULL,
	"external_id" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"author_id" text,
	"text" text DEFAULT '' NOT NULL,
	"class" "autopost_comment_class" NOT NULL,
	"commented_at" timestamp with time zone NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_comments_account_external_key" UNIQUE("account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "social_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"source" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_plans_account_week_key" UNIQUE("account_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "social_post_metrics" (
	"post_id" uuid NOT NULL,
	"day" date NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_post_metrics_post_id_day_pk" PRIMARY KEY("post_id","day")
);
--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_account_metrics" ADD CONSTRAINT "social_account_metrics_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_autoposts" ADD CONSTRAINT "social_autoposts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_autoposts" ADD CONSTRAINT "social_autoposts_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_autoposts" ADD CONSTRAINT "social_autoposts_plan_id_social_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."social_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_autoposts" ADD CONSTRAINT "social_autoposts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_autoposts" ADD CONSTRAINT "social_autoposts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_comment_id_social_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."social_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_post_id_social_autoposts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_autoposts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_plans" ADD CONSTRAINT "social_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_plans" ADD CONSTRAINT "social_plans_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_plans" ADD CONSTRAINT "social_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_metrics" ADD CONSTRAINT "social_post_metrics_post_id_social_autoposts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_autoposts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_kits_workspace_uq" ON "brand_kits" USING btree ("workspace_id") WHERE account_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_kits_account_uq" ON "brand_kits" USING btree ("account_id") WHERE account_id is not null;--> statement-breakpoint
CREATE INDEX "social_autoposts_account_scheduled_idx" ON "social_autoposts" USING btree ("account_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "social_autoposts_workspace_idx" ON "social_autoposts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "social_autoposts_due_idx" ON "social_autoposts" USING btree ("status","scheduled_at") WHERE status = 'scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX "social_autoposts_account_external_uq" ON "social_autoposts" USING btree ("account_id","external_id") WHERE external_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "social_comment_replies_active_uq" ON "social_comment_replies" USING btree ("comment_id") WHERE status in ('pending_approval', 'needs_claude', 'scheduled');--> statement-breakpoint
CREATE INDEX "social_comment_replies_due_idx" ON "social_comment_replies" USING btree ("status","send_at") WHERE status = 'scheduled';--> statement-breakpoint
CREATE INDEX "social_comments_account_commented_idx" ON "social_comments" USING btree ("account_id","commented_at");