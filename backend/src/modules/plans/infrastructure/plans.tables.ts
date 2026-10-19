import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";

export const campaignPlanStatus = pgEnum("campaign_plan_status", [
  "draft",
  "created",
  "launched",
  "discarded",
]);

export const campaignPlans = pgTable(
  "campaign_plans",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(),
    status: campaignPlanStatus("status").notNull().default("draft"),
    plan: jsonb("plan").$type<Record<string, unknown>>().notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    adAccountId: text("ad_account_id"),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("campaign_plans_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
  ],
);

export type CampaignPlanRow = typeof campaignPlans.$inferSelect;
export type CampaignPlanStatus = (typeof campaignPlanStatus.enumValues)[number];
