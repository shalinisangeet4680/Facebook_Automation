import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import { MetaConnectionRow, metaConnections } from "./meta.tables";

@Injectable()
export class MetaConnectionRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async find(workspaceId: string): Promise<MetaConnectionRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(metaConnections)
        .where(eq(metaConnections.workspaceId, workspaceId))
        .limit(1),
    );
  }

  async upsert(
    input: {
      workspaceId: string;
      tokenCiphertext: string;
      tokenLast4: string;
      systemUserId: string;
      systemUserName: string;
      grantedScopes: string[];
    },
    tx: Executor = this.db,
  ): Promise<MetaConnectionRow> {
    const now = new Date();
    const [row] = await tx
      .insert(metaConnections)
      .values({ ...input, status: "active", checkedAt: now })
      .onConflictDoUpdate({
        target: metaConnections.workspaceId,
        set: { ...input, status: "active", checkedAt: now, createdAt: now },
      })
      .returning();
    return row!;
  }

  async markInvalid(workspaceId: string): Promise<void> {
    await this.db
      .update(metaConnections)
      .set({ status: "invalid", checkedAt: new Date() })
      .where(eq(metaConnections.workspaceId, workspaceId));
  }

  async markChecked(
    workspaceId: string,
    grantedScopes: string[],
  ): Promise<void> {
    await this.db
      .update(metaConnections)
      .set({ status: "active", checkedAt: new Date(), grantedScopes })
      .where(eq(metaConnections.workspaceId, workspaceId));
  }

  async listActive(): Promise<MetaConnectionRow[]> {
    return this.db
      .select()
      .from(metaConnections)
      .where(eq(metaConnections.status, "active"));
  }

  async delete(workspaceId: string, tx: Executor = this.db): Promise<void> {
    await tx
      .delete(metaConnections)
      .where(eq(metaConnections.workspaceId, workspaceId));
  }
}
