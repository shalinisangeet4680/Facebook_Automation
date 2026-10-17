import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { WorkspaceAiService } from "./application/workspace-ai.service";
import { ESCALATION_NOTIFIER } from "./domain/ports/notifier";
import { POST_AI } from "./domain/ports/post-ai";
import { REPLY_AI } from "./domain/ports/reply-ai";
import { AnthropicPostAi } from "./infrastructure/anthropic-post.ai";
import { AnthropicReplyAi } from "./infrastructure/anthropic-reply.ai";
import { MockPostAi } from "./infrastructure/mock-post.ai";
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
      provide: POST_AI,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("AI_MOCK", { infer: true })
          ? new MockPostAi()
          : new AnthropicPostAi(),
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
  exports: [REPLY_AI, POST_AI, ESCALATION_NOTIFIER, WorkspaceAiService],
})
export class EngineModule {}
