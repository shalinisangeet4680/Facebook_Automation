CREATE TYPE "public"."creative_kind" AS ENUM('image', 'video');--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "kind" "creative_kind" DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "duration_seconds" double precision;