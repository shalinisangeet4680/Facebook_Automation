import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS } from "@shared/cache/redis";
import { CryptoService } from "@shared/security/crypto.service";

export const CONFIRM_TTL_SECONDS = 600;

@Injectable()
export class ConfirmationService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly crypto: CryptoService,
  ) {}

  async issue(
    workspaceId: string,
    action: string,
    args: unknown,
  ): Promise<string> {
    const token = this.crypto.randomToken(12);
    await this.redis.set(
      this.key(workspaceId, token),
      this.fingerprint(action, args),
      "EX",
      CONFIRM_TTL_SECONDS,
    );
    return token;
  }

  async consume(
    workspaceId: string,
    action: string,
    args: unknown,
    token: string,
  ): Promise<boolean> {
    const stored = await this.redis.getdel(this.key(workspaceId, token));
    return stored !== null && stored === this.fingerprint(action, args);
  }

  private key(workspaceId: string, token: string): string {
    return `confirm:${workspaceId}:${this.crypto.hash(token)}`;
  }

  private fingerprint(action: string, args: unknown): string {
    return this.crypto.hash(`${action}:${JSON.stringify(args)}`);
  }
}
