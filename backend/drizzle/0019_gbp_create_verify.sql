ALTER TABLE "gbp_locations" ADD COLUMN "verification_state" text DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD COLUMN "verification_method" text;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD COLUMN "verification_name" text;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD COLUMN "verification_target" text;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD COLUMN "verification_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gbp_locations" ADD COLUMN "created_in_app" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "gbp_locations" SET "verification_state" = 'unverified' WHERE "verified" = false;