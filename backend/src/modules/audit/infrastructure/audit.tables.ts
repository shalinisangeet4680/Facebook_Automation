import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, primaryId } from "../../../shared/database/columns";
import { workspaces } from "../../iam/infrastructure/iam.tables";

export const auditActor = pgEnum("audit_actor", ["user", "system", "ai"]);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actor: auditActor("actor").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    target: text("target"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_events_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type AuditActor = (typeof auditActor.enumValues)[number];
