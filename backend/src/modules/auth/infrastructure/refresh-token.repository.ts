import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import { RefreshTokenRow, refreshTokens } from "./auth.tables";

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async insert(
    input: {
      userId: string;
      workspaceId: string;
      familyId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent: string | null;
      ip: string | null;
    },
    tx: Executor = this.db,
  ): Promise<void> {
    await tx.insert(refreshTokens).values(input);
  }

  async findByHash(
    tokenHash: string,
    tx: Executor = this.db,
  ): Promise<RefreshTokenRow | null> {
    return firstOrNull(
      await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1),
    );
  }

  async markReplaced(id: string, tx: Executor = this.db): Promise<boolean> {
    const rows = await tx
      .update(refreshTokens)
      .set({ replacedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.id, id),
          isNull(refreshTokens.replacedAt),
          isNull(refreshTokens.revokedAt),
        ),
      )
      .returning({ id: refreshTokens.id });
    return rows.length === 1;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
      );
  }

  async deleteExpired(cutoff: Date): Promise<number> {
    const rows = await this.db
      .delete(refreshTokens)
      .where(
        or(
          lt(refreshTokens.expiresAt, cutoff),
          lt(refreshTokens.revokedAt, cutoff),
        ),
      )
      .returning({ id: refreshTokens.id });
    return rows.length;
  }
}
