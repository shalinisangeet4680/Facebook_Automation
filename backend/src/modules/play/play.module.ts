import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { PlayEngine } from "./application/play-engine.service";
import { PlayService } from "./application/play.service";
import { PLAY_API } from "./domain/ports/play-api";
import { GooglePlayClient } from "./infrastructure/google-play.client";
import { MockPlayApi } from "./infrastructure/mock-play.api";
import { PlayRepository } from "./infrastructure/play.repository";
import { PlayController } from "./interface/play.controller";

@Module({
  controllers: [PlayController],
  providers: [
    PlayRepository,
    PlayEngine,
    PlayService,
    {
      provide: PLAY_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("PLAY_MOCK", { infer: true })
          ? new MockPlayApi()
          : new GooglePlayClient(),
    },
  ],
  exports: [PlayService, PlayEngine],
})
export class PlayModule {}
