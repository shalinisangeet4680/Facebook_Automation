import { Module } from "@nestjs/common";

import { CacheModule } from "@shared/cache/cache.module";
import { ConfigModule } from "@shared/config/config.module";
import { DatabaseModule } from "@shared/database/database.module";
import { LoggingModule } from "@shared/logging/logging.module";
import { QueueModule } from "@shared/queue/queue.module";
import { SecurityModule } from "@shared/security/security.module";

@Module({
  imports: [
    ConfigModule,
    LoggingModule.forRoot("worker"),
    DatabaseModule,
    CacheModule,
    QueueModule,
    SecurityModule,
  ],
})
export class WorkerModule {}
