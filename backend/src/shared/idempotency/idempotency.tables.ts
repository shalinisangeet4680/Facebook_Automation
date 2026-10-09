import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, primaryId } from "../database/columns";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    statusCode: integer("status_code"),
    response: jsonb("response"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("idempotency_keys_workspace_key_uq").on(t.workspaceId, t.key),
  ],
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
