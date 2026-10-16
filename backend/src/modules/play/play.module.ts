import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { OAuthModule } from "@modules/oauth/oauth.module";
import { Env } from "@shared/config/env.validation";

import { PlayEngine } from "./application/play-engine.service";
import { PlayAgentService } from "./application/play-agent.service";
import { PlayInboxService } from "./application/play-inbox.service";
import { PlayWorkspaceService } from "./application/play-workspace.service";
import { PlayService } from "./application/play.service";
import { ESCALATION_NOTIFIER } from "./domain/ports/notifier";
import { PLAY_API } from "./domain/ports/play-api";
import { REPLY_AI } from "./domain/ports/reply-ai";
import { AnthropicReplyAi } from "./infrastructure/anthropic-reply.ai";
import { MockReplyAi } from "./infrastructure/mock-reply.ai";
import { MockNotifier, SlackNotifier } from "./infrastructure/slack.notifier";
import { GooglePlayClient } from "./infrastructure/google-play.client";
import { MockPlayApi } from "./infrastructure/mock-play.api";
import { PlayRepository } from "./infrastructure/play.repository";
import { PlayController } from "./interface/play.controller";

@Module({
  imports: [OAuthModule],
  controllers: [PlayController],
  providers: [
    PlayRepository,
    PlayEngine,
    PlayService,
    PlayInboxService,
    PlayWorkspaceService,
    PlayAgentService,
    {
      provide: REPLY_AI,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("AI_MOCK", { infer: true })
          ? new MockReplyAi()
          : new AnthropicReplyAi(),
    },
    {
      provide: ESCALATION_NOTIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("PLAY_MOCK", { infer: true })
          ? new MockNotifier()
          : new SlackNotifier(),
    },
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
