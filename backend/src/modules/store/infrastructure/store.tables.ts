import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";
import { ASSET_KINDS, PROJECT_STATUSES } from "../domain/store.rules";

export const storeProjectStatus = pgEnum(
  "store_project_status",
  PROJECT_STATUSES,
);
export const storeAssetKind = pgEnum("store_asset_kind", ASSET_KINDS);

export const storeProjects = pgTable(
  "store_projects",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    status: storeProjectStatus("status").notNull().default("draft"),
    chosenStyle: text("chosen_style"),
    chosenLanguages: jsonb("chosen_languages").$type<string[]>(),
    chosenSizes: jsonb("chosen_sizes").$type<string[]>(),
    uploadTokenHash: text("upload_token_hash").unique(),
    uploadTokenExpiresAt: timestamp("upload_token_expires_at", {
      withTimezone: true,
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("store_projects_workspace_slug_key").on(t.workspaceId, t.slug),
    index("store_projects_workspace_updated_idx").on(
      t.workspaceId,
      t.updatedAt,
    ),
  ],
);

export const storeAssets = pgTable(
  "store_assets",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => storeProjects.id, { onDelete: "cascade" }),
    kind: storeAssetKind("kind").notNull(),
    name: text("name").notNull(),
    style: text("style").notNull().default(""),
    lang: text("lang").notNull().default(""),
    size: text("size").notNull().default(""),
    storageKey: text("storage_key").notNull().unique(),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("store_assets_variant_key").on(
      t.projectId,
      t.kind,
      t.name,
      t.style,
      t.lang,
      t.size,
    ),
  ],
);

export type StoreProjectRow = typeof storeProjects.$inferSelect;
export type StoreAssetRow = typeof storeAssets.$inferSelect;
