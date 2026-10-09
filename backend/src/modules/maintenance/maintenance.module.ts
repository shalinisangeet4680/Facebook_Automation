import { Module } from "@nestjs/common";

import { AuthModule } from "@modules/auth/auth.module";
import { MetaModule } from "@modules/meta/meta.module";

import { MaintenanceService } from "./application/maintenance.service";
import { MaintenanceProcessor } from "./infrastructure/maintenance.processor";
import { MaintenanceScheduler } from "./infrastructure/maintenance.scheduler";

@Module({
  imports: [AuthModule, MetaModule],
  providers: [MaintenanceService, MaintenanceProcessor, MaintenanceScheduler],
})
export class MaintenanceModule {}
