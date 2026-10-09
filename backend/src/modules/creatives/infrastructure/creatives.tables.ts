import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, primaryId } from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";

export const creativeSource = pgEnum("creative_source", ["upload", "claude"]);

export const creatives = pgTable(
  "creatives",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: creativeSource("source").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("creatives_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export type CreativeRow = typeof creatives.$inferSelect;
