import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";
import { AI_MODES } from "../domain/engine.types";

export const automationAiModes = pgEnum("play_ai_mode", AI_MODES);

export const workspaceAutomationSettings = pgTable(
  "play_workspace_settings",
  {
    workspaceId: uuid("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    aiMode: automationAiModes("ai_mode").notNull().default("platform"),
    aiKeyCiphertext: text("ai_key_ciphertext"),
    aiKeyHint: text("ai_key_hint"),
    slackWebhookCiphertext: text("slack_webhook_ciphertext"),
    slackChannel: text("slack_channel"),
    agentsCanPost: boolean("agents_can_post").notNull().default(false),
    notifyNewLeads: boolean("notify_new_leads").notNull().default(true),
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

export type WorkspaceAutomationRow =
  typeof workspaceAutomationSettings.$inferSelect;
