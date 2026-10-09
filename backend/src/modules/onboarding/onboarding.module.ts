import { Module } from "@nestjs/common";

import { MetaModule } from "@modules/meta/meta.module";

import { OnboardingService } from "./application/onboarding.service";
import { OnboardingRepository } from "./infrastructure/onboarding.repository";
import { OnboardingController } from "./interface/onboarding.controller";

@Module({
  imports: [MetaModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingRepository],
  exports: [OnboardingService],
})
export class OnboardingModule {}
