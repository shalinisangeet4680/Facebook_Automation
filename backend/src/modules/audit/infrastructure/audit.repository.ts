import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, lt } from "drizzle-orm";

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
