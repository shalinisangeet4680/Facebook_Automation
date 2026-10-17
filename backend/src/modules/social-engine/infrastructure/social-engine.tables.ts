import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
  REPLY_SOURCES,
  REPLY_STATUSES,
} from "@modules/engine/domain/engine.types";
import {
  ACCOUNT_STATUSES,
  AccountMetricValues,
  AutopostSettings,
  BestTimes,
  BrandKit,
  COMMENT_CLASSES,
  CONTENT_TYPES,
  LOGIN_KINDS,
  MediaItem,
  POST_FORMATS,
  POST_MODES,
  POST_STATUSES,
  PostMetricValues,
  SOCIAL_PLATFORMS,
} from "../domain/social.types";

export const autopostPlatform = pgEnum("autopost_platform", SOCIAL_PLATFORMS);
export const autopostLogin = pgEnum("autopost_login", LOGIN_KINDS);
export const autopostAccountStatus = pgEnum(
  "autopost_account_status",
  ACCOUNT_STATUSES,
);
export const autopostFormat = pgEnum("autopost_format", POST_FORMATS);
export const autopostContentType = pgEnum(
  "autopost_content_type",
  CONTENT_TYPES,
);
export const autopostStatus = pgEnum("autopost_status", POST_STATUSES);
export const autopostMode = pgEnum("autopost_mode", POST_MODES);
export const autopostCommentClass = pgEnum(
  "autopost_comment_class",
  COMMENT_CLASSES,
);
export const autopostReplyStatus = pgEnum(
  "autopost_reply_status",
  REPLY_STATUSES,
);
export const autopostReplySource = pgEnum(
  "autopost_reply_source",
  REPLY_SOURCES,
);

const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    platform: autopostPlatform("platform").notNull(),
    login: autopostLogin("login").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    username: text("username"),
    avatarUrl: text("avatar_url"),
    category: text("category"),
    pageId: text("page_id"),
    tokenCiphertext: text("token_ciphertext").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    status: autopostAccountStatus("status").notNull().default("active"),
    error: text("error"),
    followers: integer("followers").notNull().default(0),
    settings: jsonb("settings").$type<AutopostSettings>().notNull(),
    bestTimes: jsonb("best_times").$type<BestTimes>(),
    commentsSyncedAt: timestamp("comments_synced_at", { withTimezone: true }),
    metricsSyncedAt: timestamp("metrics_synced_at", { withTimezone: true }),
    digestSentAt: timestamp("digest_sent_at", { withTimezone: true }),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    pauseReason: text("pause_reason"),
    connectedBy: uuid("connected_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("social_accounts_workspace_platform_external_key").on(
      t.workspaceId,
      t.platform,
      t.externalId,
    ),
  ],
);

export const brandKits = pgTable(
  "brand_kits",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    accountId: uuid("account_id").references(() => socialAccounts.id, {
      onDelete: "cascade",
    }),
    kit: jsonb("kit").$type<BrandKit>().notNull(),
    prefilledAt: timestamp("prefilled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("brand_kits_workspace_uq")
      .on(t.workspaceId)
      .where(sql`account_id is null`),
    uniqueIndex("brand_kits_account_uq")
      .on(t.accountId)
      .where(sql`account_id is not null`),
  ],
);

export const socialPlans = pgTable(
  "social_plans",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    summary: text("summary").notNull().default(""),
    source: text("source").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("social_plans_account_week_key").on(t.accountId, t.weekStart)],
);

export const socialAutoposts = pgTable(
  "social_autoposts",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => socialPlans.id, {
      onDelete: "set null",
    }),
    platform: autopostPlatform("platform").notNull(),
    format: autopostFormat("format").notNull(),
    contentType: autopostContentType("content_type").notNull(),
    idea: text("idea"),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    firstComment: text("first_comment"),
    altText: text("alt_text"),
    media: jsonb("media").$type<MediaItem[]>().notNull().default([]),
    link: text("link"),
    location: text("location"),
    collaborators: text("collaborators")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: autopostStatus("status").notNull(),
    mode: autopostMode("mode").notNull().default("approval"),
    heldReason: text("held_reason"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    externalId: text("external_id"),
    permalink: text("permalink"),
    firstCommentId: text("first_comment_id"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    source: text("source").notNull().default("app"),
    aiWritten: boolean("ai_written").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("social_autoposts_account_scheduled_idx").on(
      t.accountId,
      t.scheduledAt,
    ),
    index("social_autoposts_workspace_idx").on(t.workspaceId, t.createdAt),
    index("social_autoposts_due_idx")
      .on(t.status, t.scheduledAt)
      .where(sql`status = 'scheduled'`),
    uniqueIndex("social_autoposts_account_external_uq")
      .on(t.accountId, t.externalId)
      .where(sql`external_id is not null`),
  ],
);

export const socialPostMetrics = pgTable(
  "social_post_metrics",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => socialAutoposts.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    values: jsonb("values").$type<PostMetricValues>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.day] })],
);

export const socialAccountMetrics = pgTable(
  "social_account_metrics",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    values: jsonb("values").$type<AccountMetricValues>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.day] })],
);

export const socialComments = pgTable(
  "social_comments",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => socialAutoposts.id, {
      onDelete: "set null",
    }),
    externalPostId: text("external_post_id").notNull(),
    externalId: text("external_id").notNull(),
    author: text("author").notNull().default(""),
    authorId: text("author_id"),
    text: text("text").notNull().default(""),
    class: autopostCommentClass("class").notNull(),
    commentedAt: timestamp("commented_at", { withTimezone: true }).notNull(),
    hidden: boolean("hidden").notNull().default(false),
    replyText: text("reply_text"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("social_comments_account_external_key").on(
      t.accountId,
      t.externalId,
    ),
    index("social_comments_account_commented_idx").on(
      t.accountId,
      t.commentedAt,
    ),
  ],
);

export const socialCommentReplies = pgTable(
  "social_comment_replies",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => socialComments.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    source: autopostReplySource("source").notNull(),
    status: autopostReplyStatus("status").notNull(),
    auto: boolean("auto").notNull().default(false),
    note: text("note"),
    sendAt: timestamp("send_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    externalId: text("external_id"),
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
    uniqueIndex("social_comment_replies_active_uq")
      .on(t.commentId)
      .where(sql`status in ('pending_approval', 'needs_claude', 'scheduled')`),
    index("social_comment_replies_due_idx")
      .on(t.status, t.sendAt)
      .where(sql`status = 'scheduled'`),
  ],
);

export type SocialAccountRow = typeof socialAccounts.$inferSelect;
export type BrandKitRow = typeof brandKits.$inferSelect;
export type SocialPlanRow = typeof socialPlans.$inferSelect;
export type SocialAutopostRow = typeof socialAutoposts.$inferSelect;
export type SocialCommentRow = typeof socialComments.$inferSelect;
export type SocialCommentReplyRow = typeof socialCommentReplies.$inferSelect;
