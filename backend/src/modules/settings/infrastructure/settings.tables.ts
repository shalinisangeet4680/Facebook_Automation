import { doublePrecision, pgTable, uuid } from "drizzle-orm/pg-core";

import { updatedAt } from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";

export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  maxDailyBudget: doublePrecision("max_daily_budget"),
  monthlyBudget: doublePrecision("monthly_budget"),
  targetCostPerResult: doublePrecision("target_cost_per_result"),
  updatedAt: updatedAt(),
});

export type WorkspaceSettingsRow = typeof workspaceSettings.$inferSelect;
