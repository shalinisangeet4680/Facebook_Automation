import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { MetaConnectionService } from "./application/meta-connection.service";
import { META_ADS } from "./domain/ports/meta-ads";
import { META_GRAPH } from "./domain/ports/meta-graph";
import { META_PUBLISHING } from "./domain/ports/meta-publishing";
import { GraphAdsClient } from "./infrastructure/graph-ads.client";
import { GraphApiClient } from "./infrastructure/graph-api.client";
import { GraphPublishingClient } from "./infrastructure/graph-publishing.client";
import { MetaAssetRepository } from "./infrastructure/meta-asset.repository";
import { MetaConnectionRepository } from "./infrastructure/meta-connection.repository";
import { MockMetaAds } from "./infrastructure/mock-meta.ads";
import { MockMetaGraph } from "./infrastructure/mock-meta.graph";
import { MockMetaPublishing } from "./infrastructure/mock-meta.publishing";
import { MetaController } from "./interface/meta.controller";

@Module({
  controllers: [MetaController],
  providers: [
    MetaConnectionService,
    MetaConnectionRepository,
    MetaAssetRepository,
    {
      provide: META_GRAPH,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("META_MOCK", { infer: true })
          ? new MockMetaGraph()
          : new GraphApiClient(config),
    },
    {
      provide: META_ADS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("META_MOCK", { infer: true })
          ? new MockMetaAds()
          : new GraphAdsClient(config),
    },
    {
      provide: META_PUBLISHING,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("META_MOCK", { infer: true })
          ? new MockMetaPublishing()
          : new GraphPublishingClient(config),
    },
  ],
  exports: [
    MetaConnectionService,
    MetaConnectionRepository,
    META_ADS,
    META_PUBLISHING,
  ],
})
export class MetaModule {}
