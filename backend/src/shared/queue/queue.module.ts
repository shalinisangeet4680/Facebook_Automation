import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppConfig } from "@shared/config/app-config";

import { QUEUES } from "./queue.constants";

const queues = Object.values(QUEUES).map((name) => ({ name }));

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
        prefix: "bull",
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 7 * 86_400 },
        },
      }),
    }),
    BullModule.registerQueue(...queues),
  ],
  exports: [BullModule],
})
export class QueueModule {}
