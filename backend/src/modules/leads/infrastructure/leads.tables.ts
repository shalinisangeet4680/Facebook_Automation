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

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";
import { campaignPlans } from "../../plans/infrastructure/plans.tables";

export const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadStatus = pgEnum("meta_lead_status", LEAD_STATUSES);
export const leadFormSource = pgEnum("meta_lead_form_source", [
  "created",
  "discovered",
]);

export interface StoredFormQuestion {
  key: string;
  label: string;
  type: string;
}

export interface StoredLeadField {
  name: string;
  values: string[];
}

export const metaLeadForms = pgTable(
  "meta_lead_forms",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(),
    pageId: text("page_id").notNull(),
    name: text("name").notNull(),
    source: leadFormSource("source").notNull(),
    planId: uuid("plan_id").references(() => campaignPlans.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("ACTIVE"),
    questions: jsonb("questions")
      .$type<StoredFormQuestion[]>()
      .notNull()
      .default([]),
    lastLeadAt: timestamp("last_lead_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("meta_lead_forms_workspace_form_uq").on(
      t.workspaceId,
      t.formId,
    ),
  ],
);

export const metaLeads = pgTable(
  "meta_leads",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull(),
    formId: text("form_id").notNull(),
    adId: text("ad_id"),
    adName: text("ad_name"),
    adSetId: text("adset_id"),
    adSetName: text("adset_name"),
    campaignId: text("campaign_id"),
    campaignName: text("campaign_name"),
    createdTime: timestamp("created_time", { withTimezone: true }).notNull(),
    fieldData: jsonb("field_data")
      .$type<StoredLeadField[]>()
      .notNull()
      .default([]),
    status: leadStatus("status").notNull().default("new"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("meta_leads_workspace_lead_uq").on(t.workspaceId, t.leadId),
    index("meta_leads_workspace_created_idx").on(t.workspaceId, t.createdTime),
    index("meta_leads_workspace_status_idx").on(t.workspaceId, t.status),
  ],
);

export const metaLeadSyncs = pgTable("meta_lead_syncs", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  errorCode: text("error_code"),
  error: text("error"),
  updatedAt: updatedAt(),
});

export type MetaLeadFormRow = typeof metaLeadForms.$inferSelect;
export type MetaLeadRow = typeof metaLeads.$inferSelect;
export type MetaLeadSyncRow = typeof metaLeadSyncs.$inferSelect;
