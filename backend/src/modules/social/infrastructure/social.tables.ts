import {
  index,
  pgEnum,
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
import { creatives } from "../../creatives/infrastructure/creatives.tables";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";

export const socialPostStatus = pgEnum("social_post_status", [
  "scheduled",
  "publishing",
  "published",
  "partially_published",
  "failed",
  "cancelled",
]);

export const socialPosts = pgTable(
  "social_posts",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    creativeId: uuid("creative_id").references(() => creatives.id, {
      onDelete: "set null",
    }),
    imageUrl: text("image_url").notNull(),
    mediaType: text("media_type").notNull().default("image"),
    platforms: text("platforms").array().notNull(),
    facebookCaption: text("facebook_caption"),
    instagramCaption: text("instagram_caption"),
    status: socialPostStatus("status").notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    facebookPostId: text("facebook_post_id"),
    facebookPermalink: text("facebook_permalink"),
    facebookError: text("facebook_error"),
    instagramMediaId: text("instagram_media_id"),
    instagramPermalink: text("instagram_permalink"),
    instagramError: text("instagram_error"),
    source: text("source").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("social_posts_workspace_scheduled_idx").on(
      t.workspaceId,
      t.scheduledAt,
    ),
    index("social_posts_creative_idx").on(t.creativeId),
  ],
);

export type SocialPostRow = typeof socialPosts.$inferSelect;
export type SocialPostStatus = (typeof socialPostStatus.enumValues)[number];
