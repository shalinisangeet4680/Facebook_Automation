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
  real,
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
  ReplySettings,
  TEMPLATE_CATEGORIES,
  TemplateBody,
} from "@modules/engine/domain/engine.types";
import {
  BusinessInfo,
  DailyMetrics,
  POST_STATUSES,
  POST_TYPES,
  PostContent,
} from "../domain/business.types";
import { VerificationState } from "../domain/profile.types";

export const gbpConnectionStatus = pgEnum("gbp_connection_status", [
  "active",
  "error",
]);
export const gbpReplyStatus = pgEnum("gbp_reply_status", REPLY_STATUSES);
export const gbpReplySource = pgEnum("gbp_reply_source", REPLY_SOURCES);
export const gbpTemplateCategory = pgEnum(
  "gbp_template_category",
  TEMPLATE_CATEGORIES,
);
export const gbpPostType = pgEnum("gbp_post_type", POST_TYPES);
export const gbpPostStatus = pgEnum("gbp_post_status", POST_STATUSES);

const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const gbpConnections = pgTable(
  "gbp_connections",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    email: text("email").notNull(),
    refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
    status: gbpConnectionStatus("status").notNull().default("active"),
    error: text("error"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("gbp_connections_workspace_email_key").on(t.workspaceId, t.email),
  ],
);

export const gbpLocations = pgTable(
  "gbp_locations",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => gbpConnections.id, { onDelete: "cascade" }),
    accountName: text("account_name").notNull(),
    locationName: text("location_name").notNull(),
    title: text("title").notNull(),
    info: jsonb("info").$type<BusinessInfo>().notNull(),
    placeId: text("place_id"),
    mapsUri: text("maps_uri"),
    newReviewUri: text("new_review_uri"),
    verified: boolean("verified").notNull().default(true),
    verificationState: text("verification_state")
      .$type<VerificationState>()
      .notNull()
      .default("verified"),
    verificationMethod: text("verification_method"),
    verificationName: text("verification_name"),
    verificationTarget: text("verification_target"),
    verificationStartedAt: timestamp("verification_started_at", {
      withTimezone: true,
    }),
    createdInApp: boolean("created_in_app").notNull().default(false),
    settings: jsonb("settings").$type<ReplySettings>().notNull(),
    variables: jsonb("variables")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    averageRating: real("average_rating"),
    totalReviews: integer("total_reviews").notNull().default(0),
    firstSyncedAt: timestamp("first_synced_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    metricsSyncedAt: timestamp("metrics_synced_at", { withTimezone: true }),
    syncError: text("sync_error"),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    pauseReason: text("pause_reason"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: text("archive_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("gbp_locations_workspace_location_key").on(
      t.workspaceId,
      t.locationName,
    ),
  ],
);

export const gbpReviews = pgTable(
  "gbp_reviews",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => gbpLocations.id, { onDelete: "cascade" }),
    reviewName: text("review_name").notNull(),
    reviewId: text("review_id").notNull(),
    authorName: text("author_name").notNull().default(""),
    authorPhoto: text("author_photo"),
    stars: integer("stars").notNull(),
    text: text("text").notNull().default(""),
    language: text("language"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    updatedOnGoogleAt: timestamp("updated_on_google_at", {
      withTimezone: true,
    }).notNull(),
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
    unique("gbp_reviews_location_review_key").on(t.locationId, t.reviewId),
    index("gbp_reviews_location_reviewed_idx").on(t.locationId, t.reviewedAt),
  ],
);

export const gbpTemplates = pgTable(
  "gbp_templates",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    locationId: uuid("location_id").references(() => gbpLocations.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    category: gbpTemplateCategory("category").notNull(),
    bodies: jsonb("bodies").$type<TemplateBody[]>().notNull(),
    ratings: jsonb("ratings").$type<number[]>().notNull().default([]),
    hidden: boolean("hidden").notNull().default(false),
    presetKey: text("preset_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("gbp_templates_workspace_idx").on(t.workspaceId),
    uniqueIndex("gbp_templates_workspace_preset_uq")
      .on(t.workspaceId, t.presetKey)
      .where(sql`preset_key is not null and location_id is null`),
  ],
);

export const gbpReplies = pgTable(
  "gbp_replies",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => gbpLocations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => gbpReviews.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    source: gbpReplySource("source").notNull(),
    templateId: uuid("template_id").references(() => gbpTemplates.id, {
      onDelete: "set null",
    }),
    status: gbpReplyStatus("status").notNull(),
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
    uniqueIndex("gbp_replies_active_review_uq")
      .on(t.reviewId)
      .where(sql`status in ('pending_approval', 'needs_claude', 'scheduled')`),
    index("gbp_replies_due_idx")
      .on(t.status, t.sendAt)
      .where(sql`status = 'scheduled'`),
  ],
);

export const gbpPosts = pgTable(
  "gbp_posts",
  {
    id: primaryId(),
    workspaceId: workspaceId(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => gbpLocations.id, { onDelete: "cascade" }),
    type: gbpPostType("type").notNull(),
    content: jsonb("content").$type<PostContent>().notNull(),
    status: gbpPostStatus("status").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    googleName: text("google_name"),
    searchUrl: text("search_url"),
    error: text("error"),
    source: text("source").notNull().default("app"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("gbp_posts_location_idx").on(t.locationId, t.createdAt),
    index("gbp_posts_due_idx")
      .on(t.status, t.scheduledAt)
      .where(sql`status = 'scheduled'`),
  ],
);

export const gbpMetrics = pgTable(
  "gbp_metrics",
  {
    locationId: uuid("location_id")
      .notNull()
      .references(() => gbpLocations.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    values: jsonb("values").$type<DailyMetrics>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.locationId, t.day] })],
);

export type GbpConnectionRow = typeof gbpConnections.$inferSelect;
export type GbpLocationRow = typeof gbpLocations.$inferSelect;
export type GbpReviewRow = typeof gbpReviews.$inferSelect;
export type GbpTemplateRow = typeof gbpTemplates.$inferSelect;
export type GbpReplyRow = typeof gbpReplies.$inferSelect;
export type GbpPostRow = typeof gbpPosts.$inferSelect;
