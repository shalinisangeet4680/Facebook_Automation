CREATE TYPE "public"."social_post_status" AS ENUM('scheduled', 'publishing', 'published', 'partially_published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"creative_id" uuid,
	"image_url" text NOT NULL,
	"platforms" text[] NOT NULL,
	"facebook_caption" text,
	"instagram_caption" text,
	"status" "social_post_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"facebook_post_id" text,
	"facebook_permalink" text,
	"facebook_error" text,
	"instagram_media_id" text,
	"instagram_permalink" text,
	"instagram_error" text,
	"source" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_posts_workspace_scheduled_idx" ON "social_posts" USING btree ("workspace_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_creative_idx" ON "social_posts" USING btree ("creative_id");