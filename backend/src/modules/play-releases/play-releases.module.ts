import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EngineModule } from "@modules/engine/engine.module";
import { PlayModule } from "@modules/play/play.module";
import { GooglePlayClient } from "@modules/play/infrastructure/google-play.client";
import { Env } from "@shared/config/env.validation";

import { PlayReleasesService } from "./application/play-releases.service";
import { RolloutGuardian } from "./application/rollout-guardian.service";
import { PLAY_RELEASES_API } from "./domain/ports/releases-api";
import { GooglePlayReleasesClient } from "./infrastructure/google-play-releases.client";
import { MockPlayReleasesApi } from "./infrastructure/mock-play-releases.api";
import { PlayReleasesRepository } from "./infrastructure/play-releases.repository";
import { PlayReleasesController } from "./interface/play-releases.controller";

@Module({
  imports: [PlayModule, EngineModule],
  controllers: [PlayReleasesController],
  providers: [
    PlayReleasesRepository,
    PlayReleasesService,
    RolloutGuardian,
    {
      provide: PLAY_RELEASES_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("PLAY_MOCK", { infer: true })
          ? new MockPlayReleasesApi()
          : new GooglePlayReleasesClient(new GooglePlayClient()),
    },
  ],
  exports: [PlayReleasesService, RolloutGuardian],
})
export class PlayReleasesModule {}
