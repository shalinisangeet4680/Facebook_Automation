CREATE TYPE "public"."creative_source" AS ENUM('upload', 'claude');--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" "creative_source" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creatives_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creatives_workspace_created_idx" ON "creatives" USING btree ("workspace_id","created_at");