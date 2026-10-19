import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { OnboardingModule } from "@modules/onboarding/onboarding.module";
import { Env } from "@shared/config/env.validation";

import { MetaOAuthService } from "./application/meta-oauth.service";
import { META_LOGIN } from "./domain/ports/meta-login";
import { GraphLoginClient } from "./infrastructure/graph-login.client";
import { MockMetaLogin } from "./infrastructure/mock-meta.login";
import { MetaOAuthController } from "./interface/meta-oauth.controller";
import { MetaModule } from "./meta.module";

@Module({
  imports: [MetaModule, OnboardingModule],
  controllers: [MetaOAuthController],
  providers: [
    MetaOAuthService,
    {
      provide: META_LOGIN,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("META_MOCK", { infer: true })
          ? new MockMetaLogin(config)
          : new GraphLoginClient(config),
    },
  ],
})
export class MetaLoginModule {}
