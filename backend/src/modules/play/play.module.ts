import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AutomationModule } from "@modules/automation/automation.module";
import { EngineModule } from "@modules/engine/engine.module";
import { OAuthModule } from "@modules/oauth/oauth.module";
import { Env } from "@shared/config/env.validation";

import { PlayEngine } from "./application/play-engine.service";
import { PlayAgentService } from "./application/play-agent.service";
import { PlayInboxService } from "./application/play-inbox.service";
import { PlayWorkspaceService } from "./application/play-workspace.service";
import { PlayService } from "./application/play.service";
import { PLAY_API } from "./domain/ports/play-api";
import { GooglePlayClient } from "./infrastructure/google-play.client";
import { MockPlayApi } from "./infrastructure/mock-play.api";
import { PlayRepository } from "./infrastructure/play.repository";
import { PlayController } from "./interface/play.controller";

@Module({
  imports: [OAuthModule, EngineModule, AutomationModule],
  controllers: [PlayController],
  providers: [
    PlayRepository,
    PlayEngine,
    PlayService,
    PlayInboxService,
    PlayWorkspaceService,
    PlayAgentService,
    {
      provide: PLAY_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("PLAY_MOCK", { infer: true })
          ? new MockPlayApi()
          : new GooglePlayClient(),
    },
  ],
  exports: [
    PlayService,
    PlayEngine,
    PlayInboxService,
    PlayWorkspaceService,
    PlayAgentService,
  ],
})
export class PlayModule {}
