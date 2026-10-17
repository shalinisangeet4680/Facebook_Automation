import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CreativesModule } from "@modules/creatives/creatives.module";
import { EngineModule } from "@modules/engine/engine.module";
import { Env } from "@shared/config/env.validation";

import { SocialAccountsService } from "./application/social-accounts.service";
import { SocialCommentsService } from "./application/social-comments.service";
import { SocialContentService } from "./application/social-content.service";
import { SocialEngine } from "./application/social-engine.service";
import { SocialInsightsService } from "./application/social-insights.service";
import { SOCIAL_API } from "./domain/ports/social-api";
import { GraphSocialClient } from "./infrastructure/graph-social.client";
import { MockSocialApi } from "./infrastructure/mock-social.api";
import { SocialEngineRepository } from "./infrastructure/social-engine.repository";
import { AutopostController } from "./interface/autopost.controller";

@Module({
  imports: [EngineModule, CreativesModule],
  controllers: [AutopostController],
  providers: [
    SocialEngineRepository,
    SocialEngine,
    SocialAccountsService,
    SocialContentService,
    SocialCommentsService,
    SocialInsightsService,
    {
      provide: SOCIAL_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("META_MOCK", { infer: true })
          ? new MockSocialApi()
          : new GraphSocialClient(config),
    },
  ],
  exports: [
    SocialEngine,
    SocialAccountsService,
    SocialContentService,
    SocialCommentsService,
    SocialInsightsService,
  ],
})
export class SocialEngineModule {}
