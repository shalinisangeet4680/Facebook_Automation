import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import Redis from "ioredis";

import { REDIS } from "@shared/cache/redis";
import { SQL_CLIENT, createSqlClient } from "@shared/database/database";

@Injectable()
export class DependencyHealth {
  constructor(
    private readonly indicator: HealthIndicatorService,
    @Inject(SQL_CLIENT)
    private readonly sql: ReturnType<typeof createSqlClient>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async database() {
    const check = this.indicator.check("database");
    try {
      await this.sql`select 1`;
      return check.up();
    } catch (err) {
      return check.down({ message: (err as Error).message });
    }
  }

  async redisPing() {
    const check = this.indicator.check("redis");
    try {
      return (await this.redis.ping()) === "PONG"
        ? check.up()
        : check.down({ message: "unexpected ping reply" });
    } catch (err) {
      return check.down({ message: (err as Error).message });
    }
  }
}
