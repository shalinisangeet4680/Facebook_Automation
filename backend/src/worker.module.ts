import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { AuditModule } from "@modules/audit/audit.module";
import { JobsModule } from "@modules/jobs/jobs.module";
import { MaintenanceModule } from "@modules/maintenance/maintenance.module";
import { MetaWorkerModule } from "@modules/meta/meta-worker.module";
import { CacheModule } from "@shared/cache/cache.module";
import { ConfigModule } from "@shared/config/config.module";
import { DatabaseModule } from "@shared/database/database.module";
import { IdempotencyModule } from "@shared/idempotency/idempotency.module";
import { LoggingModule } from "@shared/logging/logging.module";
import { QueueModule } from "@shared/queue/queue.module";
import { SecurityModule } from "@shared/security/security.module";

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    LoggingModule.forRoot("worker"),
    DatabaseModule,
    CacheModule,
    QueueModule,
    SecurityModule,
    IdempotencyModule,
    AuditModule,
    JobsModule,
    MetaWorkerModule,
    MaintenanceModule,
  ],
})
export class WorkerModule {}
