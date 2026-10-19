import { Module } from "@nestjs/common";

import { EngineModule } from "@modules/engine/engine.module";
import { MetaModule } from "@modules/meta/meta.module";

import { LeadSyncService } from "./application/lead-sync.service";
import { LeadsService } from "./application/leads.service";
import { LeadScheduler } from "./infrastructure/lead-scheduler";
import { LeadsRepository } from "./infrastructure/leads.repository";
import { LeadsController } from "./interface/leads.controller";

@Module({
  imports: [MetaModule, EngineModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadSyncService, LeadsRepository, LeadScheduler],
  exports: [LeadSyncService, LeadsService, LeadScheduler],
})
export class LeadsModule {}
