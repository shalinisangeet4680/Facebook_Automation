import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { TOPICS } from "../domain/play.types";
import {
  ReplyAi,
  ReplyAiError,
  ReplyAiInput,
  ReplyAiResult,
} from "../domain/ports/reply-ai";

export const REPLY_MODEL = "claude-opus-5";

const Draft = z.object({
  reply: z.string(),
  language: z.string(),
  topic: z.enum(TOPICS),
});

const TONES = {
  friendly: "warm and friendly, like a person on the team",
  professional: "polite and professional",
  concise: "short and direct, one or two sentences",
};

function system(input: ReplyAiInput) {
  return [
    `You write public developer replies to Google Play reviews for the app "${input.appName}".`,
    `Voice: ${TONES[input.tone]}.`,
    `Hard limits: plain text, no markdown, no emoji unless the reviewer used them, at most ${input.maxLength} characters.`,
    "Never promise refunds, dates or fixes that the facts below don't state, and never ask for passwords or payment details.",
    input.supportEmail
      ? `Support email: ${input.supportEmail}.`
      : "There is no support email; point people to the app's Help section instead.",
    input.developerName
      ? `Sign off as ${input.developerName} when a sign-off fits.`
      : "",
    input.latestVersion
      ? `The latest app version is ${input.latestVersion}.`
      : "",
    input.translate ? "Reply in the reviewer's language." : "Reply in English.",
    input.template
      ? input.personalize
        ? "Use the template as the skeleton and keep its intent, but mention specifics from the review so it doesn't read as a canned reply."
        : "Keep the template's wording; only translate it if needed and fix grammar."
      : "Write the reply from scratch.",
    "Also return the review's language as a short code like en or es, and the single topic that best fits the review.",
  ]
    .filter(Boolean)
    .join("\n");
}

function prompt(input: ReplyAiInput) {
  const r = input.review;
  return [
    `<review stars="${r.stars}" author="${r.author || "A Google user"}" language="${r.language ?? "unknown"}">`,
    r.text || "(no text, rating only)",
    "</review>",
    input.template ? `<template>\n${input.template}\n</template>` : "",
    input.avoid
      ? `<previous_draft>\n${input.avoid}\n</previous_draft>\nWrite a different reply from the previous draft.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export class AnthropicReplyAi implements ReplyAi {
  async draft(apiKey: string, input: ReplyAiInput): Promise<ReplyAiResult> {
    const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 });
    let response;
    try {
      response = await client.beta.messages.parse({
        model: REPLY_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: system(input),
        messages: [{ role: "user", content: prompt(input) }],
        output_config: { effort: "low", format: betaZodOutputFormat(Draft) },
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError)
        throw new ReplyAiError("auth", "The Anthropic API key was rejected.");
      if (err instanceof Anthropic.PermissionDeniedError)
        throw new ReplyAiError(
          "auth",
          "The Anthropic API key can't use this model.",
        );
      if (err instanceof Anthropic.RateLimitError)
        throw new ReplyAiError(
          "quota",
          "Claude is rate limited right now. Drafts will retry later.",
        );
      if (err instanceof Anthropic.APIError)
        throw new ReplyAiError(
          "unavailable",
          `Claude couldn't write a draft (${err.status ?? "network"}).`,
        );
      throw err;
    }
    if (response.stop_reason === "refusal")
      throw new ReplyAiError("refused", "Claude declined to draft this reply.");
    const out = response.parsed_output;
    if (!out?.reply.trim())
      throw new ReplyAiError("unavailable", "Claude returned an empty draft.");
    return {
      text: out.reply.trim(),
      language: out.language || null,
      topic: out.topic,
    };
  }
}
