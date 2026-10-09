import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { PlanService } from "./application/plan.service";
import { PlanRepository } from "./infrastructure/plan.repository";
import { PlansController } from "./interface/plans.controller";

@Module({
  imports: [AdsModule, MetaModule, SettingsModule],
  controllers: [PlansController],
  providers: [PlanService, PlanRepository],
  exports: [PlanService],
})
export class PlansModule {}
