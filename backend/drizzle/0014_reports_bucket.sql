ALTER TABLE "play_apps" ADD COLUMN "report_files" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "play_apps" ADD COLUMN "history_imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_apps" ADD COLUMN "history_error" text;--> statement-breakpoint
ALTER TABLE "play_connections" ADD COLUMN "reports_bucket" text;