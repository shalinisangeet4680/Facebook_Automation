import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";
import {
  AI_MODES,
  ReplySettings,
  REPLY_SOURCES,
  REPLY_STATUSES,
  RULE_MODES,
  RuleAction,
  RuleConditions,
  TEMPLATE_CATEGORIES,
  TemplateBody,
} from "@modules/engine/domain/engine.types";

export const playConnectionStatus = pgEnum("play_connection_status", [
  "active",
  "error",
]);
export const playTemplateCategory = pgEnum(
  "play_template_category",
  TEMPLATE_CATEGORIES,
);
export const playReplyStatus = pgEnum("play_reply_status", REPLY_STATUSES);
export const playReplySource = pgEnum("play_reply_source", REPLY_SOURCES);
export const playRuleMode = pgEnum("play_rule_mode", RULE_MODES);

const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const playConnections = pgTable(
  "play_connections",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    clientEmail: text("client_email").notNull(),
    projectId: text("project_id").notNull(),
    keyCiphertext: text("key_ciphertext").notNull(),
    status: playConnectionStatus("status").notNull().default("active"),
    error: text("error"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }),
    discoveryError: text("discovery_error"),
    reportsBucket: text("reports_bucket"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("play_connections_workspace_email_key").on(
      t.workspaceId,
      t.clientEmail,
    ),
  ],
);

export const playApps = pgTable(
  "play_apps",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => playConnections.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    title: text("title").notNull(),
    iconUrl: text("icon_url"),
    automation: boolean("automation").notNull().default(false),
    settings: jsonb("settings").$type<ReplySettings>().notNull(),
    variables: jsonb("variables")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    latestVersion: text("latest_version"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    firstSyncedAt: timestamp("first_synced_at", { withTimezone: true }),
    syncError: text("sync_error"),
    syncErrorKind: text("sync_error_kind"),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    pauseReason: text("pause_reason"),
    reportFiles: jsonb("report_files")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    historyImportedAt: timestamp("history_imported_at", { withTimezone: true }),
    historyError: text("history_error"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: text("archive_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("play_apps_workspace_package_key").on(t.workspaceId, t.packageName),
  ],
);

export const playReviews = pgTable(
  "play_reviews",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    appId: uuid("app_id")
      .notNull()
      .references(() => playApps.id, { onDelete: "cascade" }),
    reviewId: text("review_id").notNull(),
    authorName: text("author_name").notNull().default(""),
    stars: integer("stars").notNull(),
    text: text("text").notNull().default(""),
    originalText: text("original_text"),
    language: text("language"),
    appVersionName: text("app_version_name"),
    appVersionCode: integer("app_version_code"),
    device: text("device"),
    androidVersion: integer("android_version"),
    thumbsUp: integer("thumbs_up").notNull().default(0),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    replyText: text("reply_text"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    editedAfterReply: boolean("edited_after_reply").notNull().default(false),
    starsBeforeEdit: integer("stars_before_edit"),
    topic: text("topic"),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("play_reviews_app_review_key").on(t.appId, t.reviewId),
    index("play_reviews_app_reviewed_idx").on(t.appId, t.reviewedAt),
  ],
);

export const playTemplates = pgTable(
  "play_templates",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    appId: uuid("app_id").references(() => playApps.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    category: playTemplateCategory("category").notNull(),
    bodies: jsonb("bodies").$type<TemplateBody[]>().notNull(),
    ratings: jsonb("ratings").$type<number[]>().notNull().default([]),
    hidden: boolean("hidden").notNull().default(false),
    presetKey: text("preset_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("play_templates_workspace_idx").on(t.workspaceId),
    uniqueIndex("play_templates_workspace_preset_uq")
      .on(t.workspaceId, t.presetKey)
      .where(sql`preset_key is not null and app_id is null`),
  ],
);

export const playRules = pgTable(
  "play_rules",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    appId: uuid("app_id")
      .notNull()
      .references(() => playApps.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    conditions: jsonb("conditions").$type<RuleConditions>().notNull(),
    action: jsonb("action").$type<RuleAction>().notNull(),
    mode: playRuleMode("mode").notNull().default("approval"),
    delayMinutes: integer("delay_minutes").notNull().default(60),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("play_rules_app_position_idx").on(t.appId, t.position)],
);

export const playReplies = pgTable(
  "play_replies",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    appId: uuid("app_id")
      .notNull()
      .references(() => playApps.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => playReviews.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    source: playReplySource("source").notNull(),
    templateId: uuid("template_id").references(() => playTemplates.id, {
      onDelete: "set null",
    }),
    ruleId: uuid("rule_id").references(() => playRules.id, {
      onDelete: "set null",
    }),
    status: playReplyStatus("status").notNull(),
    auto: boolean("auto").notNull().default(false),
    note: text("note"),
    sendAt: timestamp("send_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    sentBy: uuid("sent_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("play_replies_active_review_uq")
      .on(t.reviewId)
      .where(sql`status in ('pending_approval', 'needs_claude', 'scheduled')`),
    index("play_replies_due_idx")
      .on(t.status, t.sendAt)
      .where(sql`status = 'scheduled'`),
    index("play_replies_app_status_idx").on(t.appId, t.status),
  ],
);

export const playAiModes = pgEnum("play_ai_mode", AI_MODES);

export const playWorkspaceSettings = pgTable(
  "play_workspace_settings",
  {
    workspaceId: uuid("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    aiMode: playAiModes("ai_mode").notNull().default("platform"),
    aiKeyCiphertext: text("ai_key_ciphertext"),
    aiKeyHint: text("ai_key_hint"),
    slackWebhookCiphertext: text("slack_webhook_ciphertext"),
    slackChannel: text("slack_channel"),
    agentsCanPost: boolean("agents_can_post").notNull().default(false),
    tokenHash: text("token_hash"),
    tokenCiphertext: text("token_ciphertext"),
    tokenUserId: uuid("token_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tokenCreatedAt: timestamp("token_created_at", { withTimezone: true }),
    tokenLastUsedAt: timestamp("token_last_used_at", { withTimezone: true }),
    tokenLastTool: text("token_last_tool"),
    previousTokenHash: text("previous_token_hash"),
    previousTokenExpiresAt: timestamp("previous_token_expires_at", {
      withTimezone: true,
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("play_workspace_settings_token_hash_uq")
      .on(t.tokenHash)
      .where(sql`token_hash is not null`),
  ],
);

export type PlayWorkspaceSettingsRow =
  typeof playWorkspaceSettings.$inferSelect;
export type PlayConnectionRow = typeof playConnections.$inferSelect;
export type PlayAppRow = typeof playApps.$inferSelect;
export type PlayReviewRow = typeof playReviews.$inferSelect;
export type PlayTemplateRow = typeof playTemplates.$inferSelect;
export type PlayRuleRow = typeof playRules.$inferSelect;
export type PlayReplyRow = typeof playReplies.$inferSelect;
