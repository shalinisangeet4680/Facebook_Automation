import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOALS,
} from "@modules/ads/domain/goals";
import { formatMoney } from "@modules/ads/domain/money";
import { ReplyAiError } from "@modules/engine/domain/ports/reply-ai";
import { REPLY_MODEL } from "@modules/engine/infrastructure/anthropic-reply.ai";

import { PlanAi, PlanAiInput, PlanAiResult } from "../domain/ports/plan-ai";

const planOutput = z.object({
  name: z.string(),
  summary: z.string(),
  conversion_event: z.enum(CONVERSION_EVENTS).nullable(),
  age_min: z.number().int().nullable(),
  age_max: z.number().int().nullable(),
  genders: z.enum(["all", "male", "female"]),
  interests: z.array(z.string()),
  primary_text: z.string(),
  alternatives: z.array(z.string()),
  headline: z.string(),
  description: z.string().nullable(),
  call_to_action: z.enum(CALLS_TO_ACTION),
  image_idea: z.string().nullable(),
  reasons: z.object({
    goal: z.string(),
    audience: z.string(),
    budget: z.string(),
    creative: z.string(),
  }),
  expected_results: z.string().nullable(),
});

function system(input: PlanAiInput): string {
  const goal = GOALS[input.goal];
  return [
    "You plan a single Meta (Facebook and Instagram) ad campaign for a small business owner who is not a marketer.",
    `The goal is fixed: ${input.goal} (Meta objective ${goal.objective}).`,
    goal.needsPixel
      ? `Pick conversion_event from: ${CONVERSION_EVENTS.join(", ")}. Prefer an event the Pixel already sends.`
      : "Set conversion_event to null.",
    `Pick call_to_action from: ${CALLS_TO_ACTION.join(", ")}.`,
    `The daily budget is fixed at ${formatMoney(input.dailyBudget, input.currency)} in the account currency (${input.currency}). The workspace limit is ${formatMoney(input.maxDailyBudget, input.currency)} a day.`,
    input.requestedDailyBudget > input.dailyBudget
      ? `The owner asked for ${formatMoney(input.requestedDailyBudget, input.currency)} but it was lowered to the limit; say so in the budget reason.`
      : "",
    input.targetCostPerResult
      ? `The owner's target cost per result is ${formatMoney(input.targetCostPerResult, input.currency)}. Use it for expected_results.`
      : "Only give expected_results when past results support it; otherwise null.",
    "Locations are fixed. Ages are fixed when given; otherwise suggest age_min and age_max between 18 and 65, or null for everyone.",
    "interests: up to 5 short Meta interest names (one to three words each, like 'Skin care' or 'Yoga'). Leave it empty when a broad audience is better.",
    'Copy: primary_text up to 300 characters, plain text, no hashtags; up to 2 alternatives; headline up to 40 characters; description up to 30 characters or null. Never invent prices, discounts, dates or testimonials that the offer doesn\'t state. Follow Meta advertising policies: no health or money claims that promise outcomes, and never address personal attributes ("Are you overweight?").',
    "name: short campaign name for the owner's list, like 'Skin care – Patna – Leads'. summary: two sentences on why this plan.",
    "reasons: one or two plain-English sentences each for goal, audience, budget and creative, written to the owner, no jargon, using the business context and past results when they help.",
    "image_idea: one sentence describing the ideal ad image.",
    `Write the name, summary and reasons in English. Write the ad copy in ${input.language ?? "the language that best fits the audience (English unless the notes say otherwise)"}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function user(input: PlanAiInput): string {
  const past = input.pastCampaigns
    .map(
      (c) =>
        `- ${c.name} (${c.objective ?? "unknown"}): spent ${formatMoney(c.spend, input.currency)}, ${c.results} results${c.costPerResult ? `, ${formatMoney(c.costPerResult, input.currency)} each` : ""}`,
    )
    .join("\n");
  return [
    "<business>",
    `Name: ${input.business.name ?? "unknown"}`,
    input.business.category ? `Category: ${input.business.category}` : "",
    input.business.sells ? `What they sell: ${input.business.sells}` : "",
    input.business.area ? `Main area: ${input.business.area}` : "",
    input.business.website ? `Website: ${input.business.website}` : "",
    `Facebook Page: ${input.business.page ?? "none"}`,
    `Instagram: ${input.business.instagram ?? "none"}`,
    `Pixel: ${input.business.pixel ? `yes, recent events: ${input.business.pixelEvents.join(", ") || "none"}` : "no"}`,
    "</business>",
    `<past_campaigns_90_days>\n${past || "none"}\n</past_campaigns_90_days>`,
    "<request>",
    `Offer: ${input.offer}`,
    `Landing page: ${input.landingUrl ?? "none (the ad links to the Facebook Page)"}`,
    `Locations: ${input.locations.join(", ")}`,
    input.ageMin || input.ageMax
      ? `Ages: ${input.ageMin ?? 18}–${input.ageMax ?? 65}`
      : "",
    `Audience notes: ${input.audienceNotes ?? "none"}`,
    `Image chosen: ${input.hasVisual ? "yes" : "no, suggest one in image_idea"}`,
    "</request>",
  ]
    .filter(Boolean)
    .join("\n");
}

export class AnthropicPlanAi implements PlanAi {
  async write(apiKey: string, input: PlanAiInput): Promise<PlanAiResult> {
    const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 });
    let response;
    try {
      response = await client.beta.messages.parse({
        model: REPLY_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: system(input),
        messages: [{ role: "user", content: user(input) }],
        output_config: {
          effort: "low",
          format: betaZodOutputFormat(planOutput),
        },
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
          `Claude couldn't write this plan (${err.status ?? "network"}).`,
        );
      throw err;
    }
    if (response.stop_reason === "refusal")
      throw new ReplyAiError("refused", "Claude declined to write this plan.");
    const out = response.parsed_output;
    if (!out) throw new ReplyAiError("unavailable", "Claude returned nothing.");
    return {
      name: out.name,
      summary: out.summary,
      conversionEvent: out.conversion_event,
      ageMin: input.ageMin ?? out.age_min,
      ageMax: input.ageMax ?? out.age_max,
      genders: out.genders,
      interests: out.interests.slice(0, 5),
      primaryText: out.primary_text,
      alternatives: out.alternatives.slice(0, 2),
      headline: out.headline,
      description: out.description,
      callToAction: out.call_to_action,
      imageIdea: out.image_idea,
      reasons: out.reasons,
      expectedResults: out.expected_results,
    };
  }
}
