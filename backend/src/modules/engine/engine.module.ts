import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { WorkspaceAiService } from "./application/workspace-ai.service";
import { ESCALATION_NOTIFIER } from "./domain/ports/notifier";
import { RELEASE_AI } from "./domain/ports/release-ai";
import { REPLY_AI } from "./domain/ports/reply-ai";
import { AnthropicReleaseAi } from "./infrastructure/anthropic-release.ai";
import { AnthropicReplyAi } from "./infrastructure/anthropic-reply.ai";
import { MockReleaseAi } from "./infrastructure/mock-release.ai";
import { MockReplyAi } from "./infrastructure/mock-reply.ai";
import { MockNotifier, SlackNotifier } from "./infrastructure/slack.notifier";

@Module({
  providers: [
    WorkspaceAiService,
    {
      provide: REPLY_AI,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("AI_MOCK", { infer: true })
          ? new MockReplyAi()
          : new AnthropicReplyAi(),
    },
    {
      provide: RELEASE_AI,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("AI_MOCK", { infer: true })
          ? new MockReleaseAi()
          : new AnthropicReleaseAi(),
    },
    {
      provide: ESCALATION_NOTIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("PLAY_MOCK", { infer: true })
          ? new MockNotifier()
          : new SlackNotifier(),
    },
  ],
  exports: [REPLY_AI, RELEASE_AI, ESCALATION_NOTIFIER, WorkspaceAiService],
})
export class EngineModule {}
