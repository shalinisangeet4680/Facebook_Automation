CREATE TYPE "public"."play_connection_kind" AS ENUM('key', 'managed');--> statement-breakpoint
ALTER TABLE "play_connections" ALTER COLUMN "key_ciphertext" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "play_connections" ADD COLUMN "kind" "play_connection_kind" DEFAULT 'key' NOT NULL;