import { Inject, Injectable } from "@nestjs/common";

import { IdentityService } from "@modules/iam/application/identity.service";
import { DATABASE, Database, Executor } from "@shared/database/database";
import { CryptoService } from "@shared/security/crypto.service";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokenService,
} from "@shared/security/token.service";
import { uuidv7 } from "@shared/util/uuid";

import { sessionEnded, sessionRefreshedElsewhere } from "../domain/auth.errors";
import {
  REFRESH_REUSE_GRACE_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../domain/auth.policy";
import { IssuedTokens, RequestMeta } from "../domain/auth.types";
import { RefreshTokenRepository } from "../infrastructure/refresh-token.repository";

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
    private readonly crypto: CryptoService,
    private readonly identity: IdentityService,
  ) {}

  start(
    userId: string,
    workspaceId: string,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    return this.issue(userId, workspaceId, uuidv7(), meta);
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    const current = await this.refreshTokens.findByHash(
      this.crypto.hash(rawToken),
    );
    if (!current || current.revokedAt) throw sessionEnded();

    if (current.replacedAt) {
      const sinceReplaced = (Date.now() - current.replacedAt.getTime()) / 1000;
      if (sinceReplaced <= REFRESH_REUSE_GRACE_SECONDS) {
        throw sessionRefreshedElsewhere();
      }
      await this.refreshTokens.revokeFamily(current.familyId);
      throw sessionEnded();
    }

    if (current.expiresAt.getTime() < Date.now()) throw sessionEnded();

    const stillMember = await this.identity.hasMembership(
      current.userId,
      current.workspaceId,
    );
    if (!stillMember) {
      await this.refreshTokens.revokeFamily(current.familyId);
      throw sessionEnded();
    }

    return this.db.transaction(async (tx) => {
      if (!(await this.refreshTokens.markReplaced(current.id, tx))) {
        throw sessionRefreshedElsewhere();
      }
      return this.issue(
        current.userId,
        current.workspaceId,
        current.familyId,
        meta,
        tx,
      );
    });
  }

  logout(sessionId: string): Promise<void> {
    return this.refreshTokens.revokeFamily(sessionId);
  }

  logoutAll(userId: string): Promise<void> {
    return this.refreshTokens.revokeAllForUser(userId);
  }

  private async issue(
    userId: string,
    workspaceId: string,
    familyId: string,
    meta: RequestMeta,
    tx?: Executor,
  ): Promise<IssuedTokens> {
    const refreshToken = this.crypto.randomToken(32);
    await this.refreshTokens.insert(
      {
        userId,
        workspaceId,
        familyId,
        tokenHash: this.crypto.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        ip: meta.ip,
      },
      tx,
    );
    return {
      accessToken: this.tokens.signAccess({
        userId,
        workspaceId,
        sessionId: familyId,
      }),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      sessionId: familyId,
    };
  }
}
