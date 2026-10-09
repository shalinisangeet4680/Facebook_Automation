import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import {
  OAuthClientRow,
  oauthClients,
  OAuthGrantRow,
  oauthGrants,
  OAuthRefreshTokenRow,
  oauthRefreshTokens,
} from "./oauth.tables";

@Injectable()
export class OAuthGrantRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  async findActive(
    userId: string,
    workspaceId: string,
    clientRowId: string,
    tx: Executor = this.db,
  ): Promise<OAuthGrantRow | null> {
    return firstOrNull(
      await tx
        .select()
        .from(oauthGrants)
        .where(
          and(
            eq(oauthGrants.userId, userId),
            eq(oauthGrants.workspaceId, workspaceId),
            eq(oauthGrants.clientId, clientRowId),
            isNull(oauthGrants.revokedAt),
          ),
        )
        .limit(1),
    );
  }

  async findById(id: string): Promise<OAuthGrantRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(oauthGrants)
        .where(eq(oauthGrants.id, id))
        .limit(1),
    );
  }

  async findActiveWithClient(
    id: string,
  ): Promise<{ grant: OAuthGrantRow; client: OAuthClientRow } | null> {
    return firstOrNull(
      await this.db
        .select({ grant: oauthGrants, client: oauthClients })
        .from(oauthGrants)
        .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
        .where(and(eq(oauthGrants.id, id), isNull(oauthGrants.revokedAt)))
        .limit(1),
    );
  }

  async insert(
    input: {
      userId: string;
      workspaceId: string;
      clientId: string;
      scopes: string[];
    },
    tx: Executor = this.db,
  ): Promise<OAuthGrantRow> {
    const [row] = await tx.insert(oauthGrants).values(input).returning();
    return row!;
  }

  async setScopes(
    id: string,
    scopes: string[],
    tx: Executor = this.db,
  ): Promise<void> {
    await tx.update(oauthGrants).set({ scopes }).where(eq(oauthGrants.id, id));
  }

  async touch(id: string, staleBefore: Date): Promise<void> {
    await this.db
      .update(oauthGrants)
      .set({ lastUsedAt: new Date() })
      .where(
        and(
          eq(oauthGrants.id, id),
          or(
            isNull(oauthGrants.lastUsedAt),
            lt(oauthGrants.lastUsedAt, staleBefore),
          ),
        ),
      );
  }

  async revoke(id: string, tx: Executor = this.db): Promise<boolean> {
    const now = new Date();
    const rows = await tx
      .update(oauthGrants)
      .set({ revokedAt: now })
      .where(and(eq(oauthGrants.id, id), isNull(oauthGrants.revokedAt)))
      .returning({ id: oauthGrants.id });
    await tx
      .update(oauthRefreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(oauthRefreshTokens.grantId, id),
          isNull(oauthRefreshTokens.revokedAt),
        ),
      );
    return rows.length === 1;
  }

  async listActive(
    userId: string,
    workspaceId: string,
  ): Promise<{ grant: OAuthGrantRow; client: OAuthClientRow }[]> {
    return this.db
      .select({ grant: oauthGrants, client: oauthClients })
      .from(oauthGrants)
      .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
      .where(
        and(
          eq(oauthGrants.userId, userId),
          eq(oauthGrants.workspaceId, workspaceId),
          isNull(oauthGrants.revokedAt),
        ),
      )
      .orderBy(desc(oauthGrants.createdAt));
  }

  async insertRefresh(
    input: { grantId: string; tokenHash: string; expiresAt: Date },
    tx: Executor = this.db,
  ): Promise<void> {
    await tx.insert(oauthRefreshTokens).values(input);
  }

  async findRefresh(tokenHash: string): Promise<OAuthRefreshTokenRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(oauthRefreshTokens)
        .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
        .limit(1),
    );
  }

  async markRefreshReplaced(
    id: string,
    tx: Executor = this.db,
  ): Promise<boolean> {
    const rows = await tx
      .update(oauthRefreshTokens)
      .set({ replacedAt: new Date() })
      .where(
        and(
          eq(oauthRefreshTokens.id, id),
          isNull(oauthRefreshTokens.replacedAt),
          isNull(oauthRefreshTokens.revokedAt),
        ),
      )
      .returning({ id: oauthRefreshTokens.id });
    return rows.length === 1;
  }
}
