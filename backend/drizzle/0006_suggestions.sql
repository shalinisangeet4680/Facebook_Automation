CREATE TYPE "public"."suggestion_severity" AS ENUM('critical', 'warning', 'opportunity');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('open', 'applied', 'dismissed', 'snoozed', 'expired');--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"severity" "suggestion_severity" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"status" "suggestion_status" DEFAULT 'open' NOT NULL,
	"fingerprint" text NOT NULL,
	"snoozed_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suggestions_workspace_fingerprint_active_uq" ON "suggestions" USING btree ("workspace_id","fingerprint") WHERE status in ('open', 'snoozed');--> statement-breakpoint
CREATE INDEX "suggestions_workspace_status_idx" ON "suggestions" USING btree ("workspace_id","status");