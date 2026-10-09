import {
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

export const onboardingStepStatus = pgEnum("onboarding_step_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped",
]);

export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    status: onboardingStepStatus("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("onboarding_progress_workspace_step_uq").on(
      t.workspaceId,
      t.step,
    ),
  ],
);

export type OnboardingProgressRow = typeof onboardingProgress.$inferSelect;
export type OnboardingStepStatus =
  (typeof onboardingStepStatus.enumValues)[number];
