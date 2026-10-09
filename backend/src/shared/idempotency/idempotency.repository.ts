import { Inject, Injectable } from "@nestjs/common";
import { and, eq, lt } from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";

import { IdempotencyKeyRow, idempotencyKeys } from "./idempotency.tables";

@Injectable()
export class IdempotencyRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async claim(input: {
    workspaceId: string;
    key: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const rows = await this.db
      .insert(idempotencyKeys)
      .values(input)
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });
    return rows.length === 1;
  }

  async find(
    workspaceId: string,
    key: string,
  ): Promise<IdempotencyKeyRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.workspaceId, workspaceId),
            eq(idempotencyKeys.key, key),
          ),
        )
        .limit(1),
    );
  }

  async complete(
    workspaceId: string,
    key: string,
    statusCode: number,
    response: unknown,
  ): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({ statusCode, response: response ?? null })
      .where(
        and(
          eq(idempotencyKeys.workspaceId, workspaceId),
          eq(idempotencyKeys.key, key),
        ),
      );
  }

  async release(workspaceId: string, key: string): Promise<void> {
    await this.db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.workspaceId, workspaceId),
          eq(idempotencyKeys.key, key),
        ),
      );
  }

  async deleteExpired(now: Date): Promise<number> {
    const rows = await this.db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.expiresAt, now))
      .returning({ id: idempotencyKeys.id });
    return rows.length;
  }
}
