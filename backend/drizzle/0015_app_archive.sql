ALTER TABLE "play_apps" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_apps" ADD COLUMN "archive_reason" text;