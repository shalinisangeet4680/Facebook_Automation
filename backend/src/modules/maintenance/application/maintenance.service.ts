import { Injectable, Logger } from "@nestjs/common";

import { OtpChallengeRepository } from "@modules/auth/infrastructure/otp-challenge.repository";
import { RefreshTokenRepository } from "@modules/auth/infrastructure/refresh-token.repository";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { MetaConnectionRepository } from "@modules/meta/infrastructure/meta-connection.repository";
import { IdempotencyRepository } from "@shared/idempotency/idempotency.repository";

const DAY_MS = 86_400_000;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly connections: MetaConnectionRepository,
    private readonly meta: MetaConnectionService,
    private readonly otps: OtpChallengeRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly idempotency: IdempotencyRepository,
  ) {}

  async checkTokens(): Promise<{
    checked: number;
    invalid: number;
    failed: number;
  }> {
    const active = await this.connections.listActive();
    let invalid = 0;
    let failed = 0;
    for (const connection of active) {
      try {
        if (
          (await this.meta.checkHealth(connection.workspaceId)) === "invalid"
        ) {
          invalid += 1;
        }
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Token check failed for ${connection.workspaceId}: ${(err as Error).message}`,
        );
      }
    }
    return { checked: active.length, invalid, failed };
  }

  async cleanup(): Promise<{
    otps: number;
    refreshTokens: number;
    idempotencyKeys: number;
  }> {
    const now = Date.now();
    const [otps, refreshTokens, idempotencyKeys] = await Promise.all([
      this.otps.deleteOlderThan(new Date(now - DAY_MS)),
      this.refreshTokens.deleteExpired(new Date(now - 7 * DAY_MS)),
      this.idempotency.deleteExpired(new Date(now)),
    ]);
    return { otps, refreshTokens, idempotencyKeys };
  }
}
