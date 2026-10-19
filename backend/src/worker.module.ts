import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { AuditModule } from "@modules/audit/audit.module";
import { JobsModule } from "@modules/jobs/jobs.module";
import { InboxWorkerModule } from "@modules/inbox/inbox-worker.module";
import { LeadsWorkerModule } from "@modules/leads/leads-worker.module";
import { MaintenanceModule } from "@modules/maintenance/maintenance.module";
import { MetaWorkerModule } from "@modules/meta/meta-worker.module";
import { PlayWorkerModule } from "@modules/play/play-worker.module";
import { PlayReleasesWorkerModule } from "@modules/play-releases/play-releases-worker.module";
import { BusinessWorkerModule } from "@modules/business/business-worker.module";
import { SocialEngineWorkerModule } from "@modules/social-engine/social-engine-worker.module";
import { SocialWorkerModule } from "@modules/social/social-worker.module";
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
    SocialWorkerModule,
    InboxWorkerModule,
    LeadsWorkerModule,
    MaintenanceModule,
    PlayWorkerModule,
    PlayReleasesWorkerModule,
    BusinessWorkerModule,
    SocialEngineWorkerModule,
  ],
})
export class WorkerModule {}
