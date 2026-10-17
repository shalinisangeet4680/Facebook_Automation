import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";
import { playApps } from "../../play/infrastructure/play.tables";

export const playReleaseGuardians = pgTable("play_release_guardians", {
  appId: uuid("app_id")
    .primaryKey()
    .references(() => playApps.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  maxCrashRate: doublePrecision("max_crash_rate").notNull().default(1.09),
  maxAnrRate: doublePrecision("max_anr_rate").notNull().default(0.47),
  minUsers: integer("min_users").notNull().default(500),
  ignoredVersion: text("ignored_version"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastMessage: text("last_message"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const playReleaseEvents = pgTable(
  "play_release_events",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => playApps.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    track: text("track").notNull(),
    versionCodes: jsonb("version_codes").$type<string[]>().notNull(),
    message: text("message").notNull(),
    actor: text("actor").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("play_release_events_app_idx").on(t.appId, t.createdAt)],
);

export type PlayReleaseGuardianRow = typeof playReleaseGuardians.$inferSelect;
export type PlayReleaseEventRow = typeof playReleaseEvents.$inferSelect;
