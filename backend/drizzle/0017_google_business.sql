CREATE TYPE "public"."gbp_connection_status" AS ENUM('active', 'error');--> statement-breakpoint
CREATE TYPE "public"."gbp_post_status" AS ENUM('draft', 'scheduled', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gbp_post_type" AS ENUM('STANDARD', 'EVENT', 'OFFER');--> statement-breakpoint
CREATE TYPE "public"."gbp_reply_source" AS ENUM('template', 'claude', 'manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."gbp_reply_status" AS ENUM('pending_approval', 'needs_claude', 'scheduled', 'sent', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."gbp_template_category" AS ENUM('positive', 'negative', 'bug', 'feature', 'billing', 'updated', 'neutral', 'custom');--> statement-breakpoint
CREATE TABLE "gbp_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"status" "gbp_connection_status" DEFAULT 'active' NOT NULL,
	"error" text,
	"discovered_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gbp_connections_workspace_email_key" UNIQUE("workspace_id","email")
);
--> statement-breakpoint
CREATE TABLE "gbp_locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"account_name" text NOT NULL,
	"location_name" text NOT NULL,
	"title" text NOT NULL,
	"info" jsonb NOT NULL,
	"place_id" text,
	"maps_uri" text,
	"new_review_uri" text,
	"verified" boolean DEFAULT true NOT NULL,
	"settings" jsonb NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"average_rating" real,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"first_synced_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"metrics_synced_at" timestamp with time zone,
	"sync_error" text,
	"paused_until" timestamp with time zone,
	"pause_reason" text,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gbp_locations_workspace_location_key" UNIQUE("workspace_id","location_name")
);
--> statement-breakpoint
CREATE TABLE "gbp_metrics" (
	"location_id" uuid NOT NULL,
	"day" date NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gbp_metrics_location_id_day_pk" PRIMARY KEY("location_id","day")
);
--> statement-breakpoint
CREATE TABLE "gbp_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"type" "gbp_post_type" NOT NULL,
	"content" jsonb NOT NULL,
	"status" "gbp_post_status" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"google_name" text,
	"search_url" text,
	"error" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gbp_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"source" "gbp_reply_source" NOT NULL,
	"template_id" uuid,
	"status" "gbp_reply_status" NOT NULL,
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
CREATE TABLE "gbp_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"review_name" text NOT NULL,
	"review_id" text NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_photo" text,
	"stars" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"language" text,
	"reviewed_at" timestamp with time zone NOT NULL,
	"updated_on_google_at" timestamp with time zone NOT NULL,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"edited_after_reply" boolean DEFAULT false NOT NULL,
	"stars_before_edit" integer,
	"topic" text,
	"skipped_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gbp_reviews_location_review_key" UNIQUE("location_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "gbp_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"location_id" uuid,
	"name" text NOT NULL,
	"category" "gbp_template_category" NOT NULL,
	"bodies" jsonb NOT NULL,
	"ratings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"preset_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gbp_connections" ADD CONSTRAINT "gbp_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_connections" ADD CONSTRAINT "gbp_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD CONSTRAINT "gbp_locations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD CONSTRAINT "gbp_locations_connection_id_gbp_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gbp_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_metrics" ADD CONSTRAINT "gbp_metrics_location_id_gbp_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."gbp_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_location_id_gbp_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."gbp_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_replies" ADD CONSTRAINT "gbp_replies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_replies" ADD CONSTRAINT "gbp_replies_location_id_gbp_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."gbp_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_replies" ADD CONSTRAINT "gbp_replies_review_id_gbp_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."gbp_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_replies" ADD CONSTRAINT "gbp_replies_template_id_gbp_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."gbp_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_replies" ADD CONSTRAINT "gbp_replies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_replies" ADD CONSTRAINT "gbp_replies_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_location_id_gbp_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."gbp_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_templates" ADD CONSTRAINT "gbp_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gbp_templates" ADD CONSTRAINT "gbp_templates_location_id_gbp_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."gbp_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gbp_posts_location_idx" ON "gbp_posts" USING btree ("location_id","created_at");--> statement-breakpoint
CREATE INDEX "gbp_posts_due_idx" ON "gbp_posts" USING btree ("status","scheduled_at") WHERE status = 'scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX "gbp_replies_active_review_uq" ON "gbp_replies" USING btree ("review_id") WHERE status in ('pending_approval', 'needs_claude', 'scheduled');--> statement-breakpoint
CREATE INDEX "gbp_replies_due_idx" ON "gbp_replies" USING btree ("status","send_at") WHERE status = 'scheduled';--> statement-breakpoint
CREATE INDEX "gbp_reviews_location_reviewed_idx" ON "gbp_reviews" USING btree ("location_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "gbp_templates_workspace_idx" ON "gbp_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gbp_templates_workspace_preset_uq" ON "gbp_templates" USING btree ("workspace_id","preset_key") WHERE preset_key is not null and location_id is null;