import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { MetaModule } from "@modules/meta/meta.module";
import { PlansModule } from "@modules/plans/plans.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { OnboardingService } from "./application/onboarding.service";
import { OnboardingRepository } from "./infrastructure/onboarding.repository";
import { OnboardingController } from "./interface/onboarding.controller";

@Module({
  imports: [MetaModule, SettingsModule, AdsModule, PlansModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingRepository],
  exports: [OnboardingService],
})
export class OnboardingModule {}
