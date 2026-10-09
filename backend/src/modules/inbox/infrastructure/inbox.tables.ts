import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, primaryId } from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";

export const suggestionSeverity = pgEnum("suggestion_severity", [
  "critical",
  "warning",
  "opportunity",
]);
export const suggestionStatus = pgEnum("suggestion_status", [
  "open",
  "applied",
  "dismissed",
  "snoozed",
  "expired",
]);

export const suggestions = pgTable(
  "suggestions",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    rule: text("rule").notNull(),
    severity: suggestionSeverity("severity").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    entityName: text("entity_name").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
    action: jsonb("action").$type<Record<string, unknown>>().notNull(),
    status: suggestionStatus("status").notNull().default("open"),
    fingerprint: text("fingerprint").notNull(),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("suggestions_workspace_fingerprint_active_uq")
      .on(t.workspaceId, t.fingerprint)
      .where(sql`status in ('open', 'snoozed')`),
    index("suggestions_workspace_status_idx").on(t.workspaceId, t.status),
  ],
);

export type SuggestionRow = typeof suggestions.$inferSelect;
