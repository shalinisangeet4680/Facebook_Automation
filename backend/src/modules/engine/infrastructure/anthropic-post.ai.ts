import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z, ZodType } from "zod";

import {
  BrandAiInput,
  BrandAiResult,
  PostAi,
  PostAiInput,
  PostAiResult,
} from "../domain/ports/post-ai";
import { ReplyAiError } from "../domain/ports/reply-ai";
import { REPLY_MODEL } from "./anthropic-reply.ai";

const postSchema = z.object({
  headline: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  first_comment: z.string().nullable(),
  alt_text: z.string().nullable(),
});

const brandSchema = z.object({
  business_type: z.string(),
  audience: z.string(),
  voice: z.enum(["friendly", "professional", "playful"]),
  topics: z.array(z.string()),
  offers: z.array(z.string()),
  hashtags: z.array(z.string()),
  cta: z.string(),
  city: z.string().nullable(),
});

const VOICES = {
  friendly: "warm and friendly, like a person on the team",
  professional: "polite, clear and professional",
  playful: "light, playful and fun, with the odd emoji",
};

function postSystem(input: PostAiInput) {
  const b = input.brand;
  return [
    `You write organic ${input.platform === "instagram" ? "Instagram" : "Facebook"} posts for "${b.name || "a local business"}"${b.businessType ? `, a ${b.businessType}` : ""}${b.city ? ` in ${b.city}` : ""}.`,
    `Voice: ${VOICES[b.voice]}.`,
    b.audience ? `Audience: ${b.audience}.` : "",
    b.offers.length
      ? `Current offers and products: ${b.offers.join("; ")}.`
      : "",
    b.cta ? `Call to action: ${b.cta}${b.link ? ` (${b.link})` : ""}.` : "",
    b.bannedWords.length
      ? `Never use these words: ${b.bannedWords.join(", ")}.`
      : "",
    `Write in ${b.language === "hi" ? "Hindi" : b.language === "hinglish" ? "Hinglish" : "English"}.`,
    `Caption: plain text, no markdown, at most ${input.maxLength} characters, without hashtags (return them separately${input.platform === "instagram" ? ", 5 to 10 relevant ones" : ", at most 3"}).`,
    "Never make health or financial claims that promise outcomes, never invent prices, dates or testimonials, and only quote customers when the idea says they agreed.",
    "headline is at most 8 words for the image. alt_text describes the image for screen readers. first_comment is optional extra context or a question, or null.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function parse<T>(
  apiKey: string,
  system: string,
  user: string,
  schema: ZodType<T>,
): Promise<T> {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 });
  let response;
  try {
    response = await client.beta.messages.parse({
      model: REPLY_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    });
  } catch (err) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    )
      throw new ReplyAiError("auth", "The Anthropic API key was rejected.");
    if (err instanceof Anthropic.RateLimitError)
      throw new ReplyAiError("quota", "Claude is rate limited right now.");
    if (err instanceof Anthropic.APIError)
      throw new ReplyAiError(
        "unavailable",
        `Claude couldn't write this (${err.status ?? "network"}).`,
      );
    throw err;
  }
  if (response.stop_reason === "refusal")
    throw new ReplyAiError("refused", "Claude declined to write this post.");
  if (!response.parsed_output)
    throw new ReplyAiError("unavailable", "Claude returned nothing.");
  return response.parsed_output as T;
}

export class AnthropicPostAi implements PostAi {
  async write(apiKey: string, input: PostAiInput): Promise<PostAiResult> {
    const out = await parse(
      apiKey,
      postSystem(input),
      [
        `<post format="${input.format}" type="${input.contentType}">`,
        input.idea,
        "</post>",
        input.avoid
          ? `<previous_caption>\n${input.avoid}\n</previous_caption>\nWrite a clearly different caption.`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      postSchema,
    );
    if (!out.caption.trim())
      throw new ReplyAiError(
        "unavailable",
        "Claude returned an empty caption.",
      );
    return {
      headline: out.headline.trim(),
      caption: out.caption.trim().slice(0, input.maxLength),
      hashtags: out.hashtags
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean),
      firstComment: out.first_comment?.trim() || null,
      altText: out.alt_text?.trim() || null,
    };
  }

  async brandKit(apiKey: string, input: BrandAiInput): Promise<BrandAiResult> {
    const out = await parse(
      apiKey,
      "You set up a social media brand kit for a small business from its website and recent posts. Be concrete and short; leave lists empty when you can't tell.",
      [
        `<business name="${input.name}" website="${input.websiteUrl ?? ""}">`,
        `<website_text>\n${input.websiteText.slice(0, 6000)}\n</website_text>`,
        `<recent_posts>\n${input.recentCaptions.slice(0, 30).join("\n---\n")}\n</recent_posts>`,
        "</business>",
      ].join("\n"),
      brandSchema,
    );
    return {
      businessType: out.business_type,
      audience: out.audience,
      voice: out.voice,
      topics: out.topics.slice(0, 10),
      offers: out.offers.slice(0, 10),
      hashtags: out.hashtags.map((t) => t.replace(/^#/, "")).slice(0, 15),
      cta: out.cta,
      city: out.city,
    };
  }
}
