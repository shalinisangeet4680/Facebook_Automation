CREATE TYPE "public"."play_ai_mode" AS ENUM('platform', 'own', 'off');--> statement-breakpoint
ALTER TYPE "public"."play_reply_source" ADD VALUE 'ai';--> statement-breakpoint
CREATE TABLE "play_workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"ai_mode" "play_ai_mode" DEFAULT 'platform' NOT NULL,
	"ai_key_ciphertext" text,
	"ai_key_hint" text,
	"slack_webhook_ciphertext" text,
	"slack_channel" text,
	"agents_can_post" boolean DEFAULT false NOT NULL,
	"token_hash" text,
	"token_ciphertext" text,
	"token_user_id" uuid,
	"token_created_at" timestamp with time zone,
	"token_last_used_at" timestamp with time zone,
	"token_last_tool" text,
	"previous_token_hash" text,
	"previous_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_apps" ADD COLUMN "sync_error_kind" text;--> statement-breakpoint
ALTER TABLE "play_apps" ADD COLUMN "paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_apps" ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "play_reviews" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "play_reviews" ADD COLUMN "skipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_reviews" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_templates" ADD COLUMN "ratings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "play_workspace_settings" ADD CONSTRAINT "play_workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_workspace_settings" ADD CONSTRAINT "play_workspace_settings_token_user_id_users_id_fk" FOREIGN KEY ("token_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "play_workspace_settings_token_hash_uq" ON "play_workspace_settings" USING btree ("token_hash") WHERE "token_hash" IS NOT NULL;--> statement-breakpoint
DELETE FROM "play_rules" WHERE "name" IN ('Unhappy reviews', 'Mixed reviews', 'Thank happy reviewers') AND "action"->>'templateId' IN (SELECT "id"::text FROM "play_templates" WHERE "preset_key" IN ('negative', 'neutral', 'thanks'));--> statement-breakpoint
DELETE FROM "play_templates" WHERE "preset_key" IN ('thanks', 'negative', 'neutral') AND "id"::text NOT IN (SELECT "action"->>'templateId' FROM "play_rules" WHERE "action"->>'templateId' IS NOT NULL);--> statement-breakpoint
UPDATE "play_templates" SET "preset_key" = NULL WHERE "preset_key" IN ('thanks', 'negative', 'neutral');
