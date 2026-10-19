import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";

export const adAudiences = pgTable(
  "ad_audiences",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targeting: jsonb("targeting").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("ad_audiences_workspace_name_uq").on(t.workspaceId, t.name),
    index("ad_audiences_workspace_updated_idx").on(t.workspaceId, t.updatedAt),
  ],
);

export type AdAudienceRow = typeof adAudiences.$inferSelect;
