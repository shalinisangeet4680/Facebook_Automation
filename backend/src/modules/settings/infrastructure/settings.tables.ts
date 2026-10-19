import { doublePrecision, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { updatedAt } from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";

export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  maxDailyBudget: doublePrecision("max_daily_budget"),
  monthlyBudget: doublePrecision("monthly_budget"),
  targetCostPerResult: doublePrecision("target_cost_per_result"),
  mainGoal: text("main_goal"),
  websiteUrl: text("website_url"),
  businessOffer: text("business_offer"),
  businessArea: text("business_area"),
  businessCategory: text("business_category"),
  adLanguage: text("ad_language"),
  updatedAt: updatedAt(),
});

export type WorkspaceSettingsRow = typeof workspaceSettings.$inferSelect;
