import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AdsModule } from "@modules/ads/ads.module";
import { CreativesModule } from "@modules/creatives/creatives.module";
import { EngineModule } from "@modules/engine/engine.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";
import { Env } from "@shared/config/env.validation";

import { PlanGeneratorService } from "./application/plan-generator.service";
import { PlanService } from "./application/plan.service";
import { PLAN_AI } from "./domain/ports/plan-ai";
import { AnthropicPlanAi } from "./infrastructure/anthropic-plan.ai";
import { MockPlanAi } from "./infrastructure/mock-plan.ai";
import { PlanRepository } from "./infrastructure/plan.repository";
import { PlansController } from "./interface/plans.controller";

@Module({
  imports: [
    AdsModule,
    MetaModule,
    SettingsModule,
    EngineModule,
    CreativesModule,
  ],
  controllers: [PlansController],
  providers: [
    PlanService,
    PlanGeneratorService,
    PlanRepository,
    {
      provide: PLAN_AI,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("AI_MOCK", { infer: true })
          ? new MockPlanAi()
          : new AnthropicPlanAi(),
    },
  ],
  exports: [PlanService],
})
export class PlansModule {}
