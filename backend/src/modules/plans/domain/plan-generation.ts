import {
  CONVERSION_EVENTS,
  CallToAction,
  ConversionEvent,
  GOALS,
  Goal,
} from "@modules/ads/domain/goals";
import { formatMoney } from "@modules/ads/domain/money";

import { CampaignPlan, parsePlan } from "./plan.schema";
import { PlanAiInput, PlanAiResult } from "./ports/plan-ai";

export interface PlanLocations {
  countries: string[];
  regions: { key: string; name: string }[];
  cities: { key: string; name: string; radiusKm?: number | null }[];
}

export interface PlanPost {
  platform: "facebook" | "instagram";
  id: string;
  permalink?: string | null;
  imageUrl?: string | null;
  text?: string | null;
}

export interface GenerationContext {
  input: PlanAiInput;
  locations: PlanLocations;
  linkUrl: string;
  imageUrl: string | null;
  post: PlanPost | null;
}

export interface BuiltPlan {
  plan: CampaignPlan;
  usedTemplate: boolean;
  problem: string | null;
}

const GOAL_TITLES: Record<Goal, string> = {
  traffic: "Website visits",
  leads: "Leads",
  sales: "Sales",
  awareness: "Awareness",
};

const DEFAULT_EVENTS: Record<Goal, ConversionEvent | null> = {
  traffic: null,
  leads: "LEAD",
  sales: "PURCHASE",
  awareness: null,
};

const DEFAULT_CTAS: Record<Goal, CallToAction> = {
  traffic: "LEARN_MORE",
  leads: "SIGN_UP",
  sales: "SHOP_NOW",
  awareness: "LEARN_MORE",
};

const GOAL_REASONS: Record<Goal, string> = {
  traffic:
    "You want people to visit your website, so Meta will show the ad to people most likely to open the page and let it load.",
  leads:
    "You want enquiries or sign-ups, so Meta will look for people most likely to fill in your form, tracked by your Pixel.",
  sales:
    "You want purchases, so Meta will look for people most likely to buy on your website, tracked by your Pixel.",
  awareness:
    "You want as many local people as possible to know about you, so Meta will spread the ad across the widest audience for the budget.",
};

const NOT_INTERESTS = new Set([
  "a",
  "aged",
  "age",
  "ages",
  "all",
  "and",
  "any",
  "are",
  "around",
  "between",
  "boys",
  "female",
  "females",
  "for",
  "from",
  "girls",
  "in",
  "interested",
  "into",
  "ladies",
  "like",
  "live",
  "living",
  "love",
  "male",
  "males",
  "men",
  "near",
  "nearby",
  "of",
  "old",
  "or",
  "people",
  "the",
  "to",
  "who",
  "with",
  "women",
  "year",
  "years",
]);

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

export function cut(text: string, max: number): string {
  const clean = squash(text);
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const space = slice.lastIndexOf(" ");
  return `${(space > max / 2 ? slice.slice(0, space) : slice).replace(/[\s,.;:–-]+$/, "")}…`;
}

const sentence = (text: string) => {
  const clean = squash(text).replace(/[.!?]+$/, "");
  return clean ? `${clean.charAt(0).toUpperCase()}${clean.slice(1)}` : clean;
};

export function clampBudget(
  requested: number,
  max: number,
): { dailyBudget: number; clamped: boolean } {
  const rounded = Math.round(requested * 100) / 100;
  if (rounded > max) return { dailyBudget: max, clamped: true };
  return { dailyBudget: rounded, clamped: false };
}

export function locationNames(locations: PlanLocations): string[] {
  return [
    ...locations.cities.map((c) => c.name),
    ...locations.regions.map((r) => r.name),
    ...locations.countries,
  ];
}

function placeLabel(names: string[]): string {
  if (!names.length) return "your area";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export function interestHints(notes: string | null): string[] {
  if (!notes) return [];
  const phrases = notes
    .split(
      /[,;/&+\n]|\band\b|\bor\b|\binterested in\b|\bwho (?:like|love)s?\b/i,
    )
    .map((p) =>
      squash(
        p
          .replace(/[\d–-]+/g, " ")
          .split(" ")
          .filter((w) => w && !NOT_INTERESTS.has(w.toLowerCase()))
          .join(" "),
      ),
    )
    .filter((p) => p.length >= 3 && p.length <= 60);
  return [...new Set(phrases.map((p) => p.toLowerCase()))].slice(0, 5);
}

export function gendersFrom(notes: string | null): "all" | "male" | "female" {
  if (!notes) return "all";
  const women =
    /\b(women|woman|female|females|ladies|mothers|moms|mums|girls)\b/i.test(
      notes,
    );
  const men = /\b(men|man|male|males|fathers|dads|boys)\b/i.test(notes);
  if (women && !men) return "female";
  if (men && !women) return "male";
  return "all";
}

export function agesFrom(
  notes: string | null,
): { ageMin: number; ageMax: number } | null {
  const match = notes?.match(/\b(\d{2})\s*(?:-|–|—|to)\s*(\d{2})\b/);
  if (!match) return null;
  const a = Math.min(65, Math.max(18, Number(match[1])));
  const b = Math.min(65, Math.max(18, Number(match[2])));
  return { ageMin: Math.min(a, b), ageMax: Math.max(a, b) };
}

function expected(input: PlanAiInput): string | null {
  if (!input.targetCostPerResult) return null;
  const perDay = input.dailyBudget / input.targetCostPerResult;
  const week = Math.max(1, Math.round(perDay * 7));
  return `Roughly ${week} results a week if each one costs about ${formatMoney(input.targetCostPerResult, input.currency)}, your target in Settings.`;
}

function budgetReason(input: PlanAiInput): string {
  const daily = formatMoney(input.dailyBudget, input.currency);
  const monthly = formatMoney(
    Math.round(input.dailyBudget * 30.4),
    input.currency,
  );
  const clamped =
    input.requestedDailyBudget > input.dailyBudget
      ? ` You asked for ${formatMoney(input.requestedDailyBudget, input.currency)}, which is above your limit of ${formatMoney(input.maxDailyBudget, input.currency)} a day in Settings, so it was lowered.`
      : "";
  const target = input.targetCostPerResult
    ? ` At your target of ${formatMoney(input.targetCostPerResult, input.currency)} per result, that's a fair test to learn what works.`
    : " Run it for at least a week before judging it so Meta has time to learn.";
  return `${daily} a day, about ${monthly} a month.${clamped}${target}`;
}

export function draftPlanCopy(input: PlanAiInput): PlanAiResult {
  const offer = sentence(input.offer);
  const brand =
    input.business.page ?? input.business.instagram ?? input.business.name;
  const places = placeLabel(input.locations);
  const notes = input.audienceNotes ? squash(input.audienceNotes) : null;
  const ages = agesFrom(notes);
  const ageMin = input.ageMin ?? ages?.ageMin ?? null;
  const ageMax = input.ageMax ?? ages?.ageMax ?? null;
  const ask: Record<Goal, string> = {
    traffic: "Tap to see more on our website.",
    leads: "Sign up today and we'll get in touch.",
    sales: "Order online today.",
    awareness: brand
      ? `Say hello to ${brand}.`
      : "Say hello to your neighbours.",
  };
  const who = notes
    ? `People who match "${cut(notes, 160)}"`
    : "Adults of all ages";
  return {
    name: cut(
      `${cut(offer, 60)} – ${places} – ${GOAL_TITLES[input.goal]}`,
      200,
    ),
    summary: cut(
      `A ${GOAL_TITLES[input.goal].toLowerCase()} campaign promoting "${cut(offer, 120)}" to people in ${places}, spending ${formatMoney(input.dailyBudget, input.currency)} a day. Everything stays paused until you launch it.`,
      2000,
    ),
    conversionEvent: DEFAULT_EVENTS[input.goal],
    ageMin,
    ageMax,
    genders: gendersFrom(notes),
    interests: interestHints(notes),
    primaryText: cut(`${offer}. ${ask[input.goal]}`, 2000),
    alternatives: [
      cut(`${offer}${brand ? ` from ${brand}` : ""}. ${ask[input.goal]}`, 2000),
      cut(
        `Looking for ${offer.charAt(0).toLowerCase()}${offer.slice(1)} in ${places}? ${ask[input.goal]}`,
        2000,
      ),
    ],
    headline: cut(offer, 40),
    description: brand ? cut(brand, 255) : null,
    callToAction: DEFAULT_CTAS[input.goal],
    imageIdea: cut(
      `A bright, uncluttered photo that clearly shows ${offer.charAt(0).toLowerCase()}${offer.slice(1)}, with little or no text on the image.`,
      500,
    ),
    reasons: {
      goal: GOAL_REASONS[input.goal],
      audience: cut(
        `${who} in ${places}${ageMin || ageMax ? `, aged ${ageMin ?? 18}–${ageMax ?? 65}` : ""}. Keeping the audience broad lets Meta find the people most likely to respond.`,
        1200,
      ),
      budget: cut(budgetReason(input), 1200),
      creative: cut(
        `The ad leads with your offer in plain words and ends with one clear next step, so people know exactly what to do.${input.hasVisual ? "" : " Add an image or an existing post before creating it in Meta."}`,
        1200,
      ),
    },
    expectedResults: expected(input),
  };
}

const clean = (text: string | null | undefined) =>
  typeof text === "string" ? squash(text) : text;

export function assemblePlan(
  ctx: GenerationContext,
  copy: PlanAiResult,
  interests: { id: string; name: string }[],
): unknown {
  const goal = GOALS[ctx.input.goal];
  const event =
    copy.conversionEvent &&
    (CONVERSION_EVENTS as readonly string[]).includes(copy.conversionEvent)
      ? copy.conversionEvent
      : DEFAULT_EVENTS[ctx.input.goal];
  return {
    name: clean(copy.name),
    summary: clean(copy.summary),
    goal: ctx.input.goal,
    conversionEvent: goal.needsPixel ? event : null,
    dailyBudget: ctx.input.dailyBudget,
    targeting: {
      countries: ctx.locations.countries,
      regions: ctx.locations.regions,
      cities: ctx.locations.cities,
      ageMin: ctx.input.ageMin ?? copy.ageMin ?? 18,
      ageMax: ctx.input.ageMax ?? copy.ageMax ?? 65,
      genders: copy.genders,
      interests,
      workPositions: [],
      industries: [],
      behaviors: [],
    },
    creative: {
      primaryText: copy.primaryText.trim(),
      alternatives: copy.alternatives
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 5),
      headline: clean(copy.headline),
      description: clean(copy.description) || null,
      linkUrl: ctx.linkUrl,
      imageUrl: ctx.post ? null : ctx.imageUrl,
      imageIdea: clean(copy.imageIdea) || null,
      callToAction: copy.callToAction,
      post: ctx.post,
    },
    reasons: {
      goal: clean(copy.reasons.goal),
      audience: clean(copy.reasons.audience),
      budget: clean(copy.reasons.budget),
      creative: clean(copy.reasons.creative),
    },
    expectedResults: clean(copy.expectedResults) || null,
  };
}

export function templatePlan(ctx: GenerationContext): CampaignPlan {
  const parsed = parsePlan(assemblePlan(ctx, draftPlanCopy(ctx.input), []));
  if (!parsed.ok)
    throw new Error(`The template plan is not valid: ${parsed.message}`);
  return parsed.plan;
}

export function buildPlan(
  ctx: GenerationContext,
  copy: PlanAiResult,
  interests: { id: string; name: string }[],
): BuiltPlan {
  let parsed: ReturnType<typeof parsePlan>;
  try {
    parsed = parsePlan(assemblePlan(ctx, copy, interests));
  } catch (err) {
    parsed = {
      ok: false,
      message: err instanceof Error ? err.message : "unreadable plan",
    };
  }
  if (parsed.ok)
    return { plan: parsed.plan, usedTemplate: false, problem: null };
  return {
    plan: templatePlan(ctx),
    usedTemplate: true,
    problem: parsed.message,
  };
}
