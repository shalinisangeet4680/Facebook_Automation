import { Module } from "@nestjs/common";

import {
  SocialEngineProcessor,
  SocialEngineScheduler,
} from "./infrastructure/social-engine.processor";
import { SocialEngineModule } from "./social-engine.module";

@Module({
  imports: [SocialEngineModule],
  providers: [SocialEngineProcessor, SocialEngineScheduler],
})
export class SocialEngineWorkerModule {}
