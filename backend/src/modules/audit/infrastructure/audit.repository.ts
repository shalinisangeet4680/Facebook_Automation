import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";

import { DATABASE, Database } from "@shared/database/database";

import { AuditEntry } from "../domain/audit.types";
import { AuditEventRow, auditEvents } from "./audit.tables";

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async insert(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditEvents).values({
      workspaceId: entry.workspaceId,
      actor: entry.actor,
      actorId: entry.actorId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      data: entry.data ?? {},
    });
  }

  async countSince(
    workspaceId: string,
    action: string,
    since: Date,
    match: Record<string, unknown>,
  ): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.workspaceId, workspaceId),
          eq(auditEvents.action, action),
          gte(auditEvents.createdAt, since),
          sql`${auditEvents.data} @> ${JSON.stringify(match)}::jsonb`,
        ),
      );
    return row?.n ?? 0;
  }

  list(
    workspaceId: string,
    limit: number,
    beforeId: string | null,
  ): Promise<AuditEventRow[]> {
    return this.db
      .select()
      .from(auditEvents)
      .where(
        beforeId
          ? and(
              eq(auditEvents.workspaceId, workspaceId),
              lt(auditEvents.id, beforeId),
            )
          : eq(auditEvents.workspaceId, workspaceId),
      )
      .orderBy(desc(auditEvents.id))
      .limit(limit + 1);
  }
}
