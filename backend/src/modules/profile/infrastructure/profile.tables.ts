import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { updatedAt } from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";

export const profileDrafts = pgTable("profile_drafts", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  facebook: jsonb("facebook")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  instagram: jsonb("instagram")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  source: text("source").notNull(),
  updatedAt: updatedAt(),
});
