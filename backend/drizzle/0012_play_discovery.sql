ALTER TABLE "play_apps" ADD COLUMN "first_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_connections" ADD COLUMN "discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "play_connections" ADD COLUMN "discovery_error" text;--> statement-breakpoint
UPDATE "play_apps" SET "first_synced_at" = "last_synced_at" WHERE "last_synced_at" IS NOT NULL AND "sync_error" IS NULL;
