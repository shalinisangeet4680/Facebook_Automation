import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";

export const metaConnectionStatus = pgEnum("meta_connection_status", [
  "active",
  "invalid",
]);

export const metaAssetKind = pgEnum("meta_asset_kind", [
  "business",
  "ad_account",
  "page",
  "instagram",
  "dataset",
]);

export const metaConnections = pgTable("meta_connections", {
  id: primaryId(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  tokenCiphertext: text("token_ciphertext").notNull(),
  tokenLast4: text("token_last4").notNull(),
  systemUserId: text("system_user_id").notNull(),
  systemUserName: text("system_user_name").notNull(),
  grantedScopes: text("granted_scopes")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  status: metaConnectionStatus("status").notNull().default("active"),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const metaAssets = pgTable(
  "meta_assets",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: metaAssetKind("kind").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("meta_assets_workspace_kind_external_uq").on(
      t.workspaceId,
      t.kind,
      t.externalId,
    ),
    index("meta_assets_workspace_kind_idx").on(t.workspaceId, t.kind),
  ],
);

export type MetaConnectionRow = typeof metaConnections.$inferSelect;
export type MetaAssetRow = typeof metaAssets.$inferSelect;
export type MetaAssetKind = (typeof metaAssetKind.enumValues)[number];
