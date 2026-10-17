import { Module } from "@nestjs/common";

import { EngineModule } from "@modules/engine/engine.module";

import { AutomationSettingsService } from "./application/automation-settings.service";
import { AutomationController } from "./interface/automation.controller";

@Module({
  imports: [EngineModule],
  controllers: [AutomationController],
  providers: [AutomationSettingsService],
  exports: [AutomationSettingsService],
})
export class AutomationModule {}
