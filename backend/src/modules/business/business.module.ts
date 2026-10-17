import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EngineModule } from "@modules/engine/engine.module";
import { Env } from "@shared/config/env.validation";

import { BusinessEngine } from "./application/business-engine.service";
import { BusinessProfilesService } from "./application/business-profiles.service";
import { BusinessReviewsService } from "./application/business-reviews.service";
import { BusinessService } from "./application/business.service";
import { BUSINESS_API } from "./domain/ports/business-api";
import { BusinessRepository } from "./infrastructure/business.repository";
import { GoogleBusinessClient } from "./infrastructure/google-business.client";
import { MockBusinessApi } from "./infrastructure/mock-business.api";
import { BusinessProfilesController } from "./interface/business-profiles.controller";
import { BusinessController } from "./interface/business.controller";

@Module({
  imports: [EngineModule],
  controllers: [BusinessController, BusinessProfilesController],
  providers: [
    BusinessRepository,
    BusinessEngine,
    BusinessService,
    BusinessReviewsService,
    BusinessProfilesService,
    {
      provide: BUSINESS_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("GBP_MOCK", { infer: true })
          ? new MockBusinessApi()
          : new GoogleBusinessClient(
              config.get("GOOGLE_CLIENT_ID", { infer: true }) ?? "",
              config.get("GOOGLE_CLIENT_SECRET", { infer: true }) ?? "",
            ),
    },
  ],
  exports: [
    BusinessService,
    BusinessReviewsService,
    BusinessProfilesService,
    BusinessEngine,
  ],
})
export class BusinessModule {}
