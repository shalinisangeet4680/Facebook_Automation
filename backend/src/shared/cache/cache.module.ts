import { Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { AppConfig } from "@shared/config/app-config";

import { CacheService } from "./cache.service";
import { createRedis, REDIS } from "./redis";

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: AppConfig) =>
        createRedis(config.get("REDIS_URL", { infer: true })),
    },
    CacheService,
  ],
  exports: [REDIS, CacheService],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
