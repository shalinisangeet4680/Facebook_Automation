CREATE TABLE "play_release_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"track" text NOT NULL,
	"version_codes" jsonb NOT NULL,
	"message" text NOT NULL,
	"actor" text NOT NULL,
	"actor_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_release_guardians" (
	"app_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"max_crash_rate" double precision DEFAULT 1.09 NOT NULL,
	"max_anr_rate" double precision DEFAULT 0.47 NOT NULL,
	"min_users" integer DEFAULT 500 NOT NULL,
	"ignored_version" text,
	"last_checked_at" timestamp with time zone,
	"last_status" text,
	"last_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_release_events" ADD CONSTRAINT "play_release_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_release_events" ADD CONSTRAINT "play_release_events_app_id_play_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."play_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_release_events" ADD CONSTRAINT "play_release_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_release_guardians" ADD CONSTRAINT "play_release_guardians_app_id_play_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."play_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_release_guardians" ADD CONSTRAINT "play_release_guardians_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_release_events_app_idx" ON "play_release_events" USING btree ("app_id","created_at");