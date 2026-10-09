import { Injectable, Logger } from "@nestjs/common";

import {
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  Page,
  toPage,
} from "@shared/pagination/pagination";

import { AuditEntry, AuditEventView } from "../domain/audit.types";
import { AuditRepository } from "../infrastructure/audit.repository";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly audit: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.audit.insert(entry);
    } catch (err) {
      this.logger.error(
        `Failed to record audit event ${entry.action}`,
        (err as Error).stack,
      );
    }
  }

  async list(
    workspaceId: string,
    limit = DEFAULT_PAGE_SIZE,
    cursor?: string,
  ): Promise<Page<AuditEventView>> {
    const rows = await this.audit.list(
      workspaceId,
      limit,
      decodeCursor(cursor),
    );
    const page = toPage(rows, limit);
    return {
      nextCursor: page.nextCursor,
      data: page.data.map((r) => ({
        id: r.id,
        actor: r.actor,
        actorId: r.actorId,
        action: r.action,
        target: r.target,
        data: r.data,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
