import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { ESCALATION_NOTIFIER } from "./domain/ports/notifier";
import { REPLY_AI } from "./domain/ports/reply-ai";
import { AnthropicReplyAi } from "./infrastructure/anthropic-reply.ai";
import { MockReplyAi } from "./infrastructure/mock-reply.ai";
import { MockNotifier, SlackNotifier } from "./infrastructure/slack.notifier";

@Module({
  providers: [
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
        config.get("PLAY_MOCK", { infer: true }) ||
        config.get("GBP_MOCK", { infer: true })
          ? new MockNotifier()
          : new SlackNotifier(),
    },
  ],
  exports: [REPLY_AI, ESCALATION_NOTIFIER],
})
export class EngineModule {}
