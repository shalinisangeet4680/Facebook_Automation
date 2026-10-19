import {
  CONVERSION_EVENTS,
  CallToAction,
  ConversionEvent,
  GOALS,
  Goal,
  LEAD_FORM_CALLS_TO_ACTION,
} from "@modules/ads/domain/goals";
import {
  LeadFormLocale,
  MAX_CHOICES,
  MAX_CUSTOM_QUESTIONS,
  PrefillQuestion,
} from "@modules/ads/domain/lead-form";
import { PlanTargeting } from "@modules/ads/domain/audience";
import { formatMoney } from "@modules/ads/domain/money";

import { CampaignPlan, parsePlan } from "./plan.schema";
import { PlanAiInput, PlanAiLeadForm, PlanAiResult } from "./ports/plan-ai";

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

export interface LeadFormContext {
  questions: PrefillQuestion[];
  privacyPolicyUrl: string;
  locale: LeadFormLocale;
  button: { type: "website"; url: string } | { type: "call"; phone: string };
}

export interface GenerationContext {
  input: PlanAiInput;
  locations: PlanLocations;
  linkUrl: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  post: PlanPost | null;
  leadForm: LeadFormContext | null;
  variants?: boolean;
  audience?: PlanTargeting | null;
}

export interface BuiltPlan {
  plan: CampaignPlan;
  usedTemplate: boolean;
  problem: string | null;
}

const GOAL_TITLES: Record<Goal, string> = {
  traffic: "Website visits",
  leads: "Leads",
  instant_leads: "Instant form leads",
  sales: "Sales",
  awareness: "Awareness",
};

const DEFAULT_EVENTS: Record<Goal, ConversionEvent | null> = {
  traffic: null,
  leads: "LEAD",
  instant_leads: null,
  sales: "PURCHASE",
  awareness: null,
};

const DEFAULT_CTAS: Record<Goal, CallToAction> = {
  traffic: "LEARN_MORE",
  leads: "SIGN_UP",
  instant_leads: "SIGN_UP",
  sales: "SHOP_NOW",
  awareness: "LEARN_MORE",
};

const GOAL_REASONS: Record<Goal, string> = {
  traffic:
    "You want people to visit your website, so Meta will show the ad to people most likely to open the page and let it load.",
  leads:
    "You want enquiries or sign-ups, so Meta will look for people most likely to fill in your form, tracked by your Pixel.",
  instant_leads:
    "You want enquiries, so people fill in a short form right inside Facebook or Instagram without leaving the app. Their details are filled in for them, and no website or Pixel is needed.",
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
    instant_leads: "Tap Sign up, leave your number and we'll call you back.",
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
    alternatives: [],
    variants: [
      {
        primaryText: cut(
          `${offer}${brand ? ` from ${brand}` : ""}. ${ask[input.goal]}`,
          2000,
        ),
        headline: cut(brand ? `${brand}: ${offer}` : `${offer} today`, 40),
      },
      {
        primaryText: cut(
          `Looking for ${offer.charAt(0).toLowerCase()}${offer.slice(1)} in ${places}? ${ask[input.goal]}`,
          2000,
        ),
        headline: cut(`${offer} in ${places}`, 40),
      },
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
        `The ad leads with your offer in plain words and ends with one clear next step, so people know exactly what to do.${input.hasVisual ? "" : " Add an image, a video or an existing post before creating it in Meta."}`,
        1200,
      ),
    },
    expectedResults: expected(input),
    leadForm: input.leadForm ? draftLeadFormCopy(input, offer, brand) : null,
  };
}

function draftLeadFormCopy(
  input: PlanAiInput,
  offer: string,
  brand: string | null,
): PlanAiLeadForm {
  const extra = input.leadForm?.extraQuestions ?? false;
  return {
    name: cut(`${cut(offer, 60)} – Instant form`, 100),
    headline: cut(offer, 60),
    description: cut(
      `Leave your details and ${brand ?? "our team"} will get in touch with you soon.`,
      500,
    ),
    customQuestions: extra
      ? [
          {
            label: "When is the best time to call you?",
            type: "multiple_choice",
            options: ["Morning", "Afternoon", "Evening"],
          },
        ]
      : [],
    thankYouTitle: "Thanks, we've got your details",
    thankYouBody: cut(
      `${brand ?? "Our team"} will contact you soon about ${offer.charAt(0).toLowerCase()}${offer.slice(1)}.`,
      500,
    ),
    buttonText: input.leadForm?.button === "call" ? "Call us" : "Visit website",
  };
}

function leadFormOf(
  ctx: GenerationContext,
  copy: PlanAiResult,
  name: string,
): unknown {
  if (!ctx.leadForm) return null;
  const form = copy.leadForm;
  const fallback = draftLeadFormCopy(
    ctx.input,
    sentence(ctx.input.offer),
    ctx.input.business.page ?? ctx.input.business.name,
  );
  const text = (value: string | null | undefined, max: number) =>
    value?.trim() ? cut(value, max) : null;
  const buttonText =
    text(form?.buttonText, 30) ?? text(fallback.buttonText, 30)!;
  const button =
    ctx.leadForm.button.type === "call"
      ? { type: "call", text: buttonText, phone: ctx.leadForm.button.phone }
      : { type: "website", text: buttonText, url: ctx.leadForm.button.url };
  const custom = ctx.input.leadForm?.extraQuestions
    ? (form?.customQuestions ?? [])
    : [];
  return {
    name: text(form?.name, 100) ?? cut(name || fallback.name, 100),
    locale: ctx.leadForm.locale,
    intro: {
      headline: text(form?.headline, 60) ?? fallback.headline,
      description: form ? text(form.description, 500) : fallback.description,
    },
    questions: ctx.leadForm.questions,
    customQuestions: custom
      .filter((q) => q.label.trim())
      .slice(0, MAX_CUSTOM_QUESTIONS)
      .map((q) => {
        const options =
          q.type === "multiple_choice"
            ? [
                ...new Set(
                  q.options
                    .map((o) => text(o, 40))
                    .filter((o): o is string => Boolean(o)),
                ),
              ].slice(0, MAX_CHOICES)
            : [];
        return {
          label: cut(q.label, 80),
          type: options.length >= 2 ? q.type : "short_answer",
          options: options.length >= 2 ? options : [],
        };
      }),
    privacyPolicyUrl: ctx.leadForm.privacyPolicyUrl,
    thankYou: {
      title: text(form?.thankYouTitle, 60) ?? fallback.thankYouTitle,
      body: text(form?.thankYouBody, 500) ?? fallback.thankYouBody,
      button,
    },
  };
}

const clean = (text: string | null | undefined) =>
  typeof text === "string" ? squash(text) : text;

function variantsOf(ctx: GenerationContext, copy: PlanAiResult): unknown[] {
  if (ctx.variants === false || ctx.post) return [];
  const drafted = copy.variants?.length
    ? copy.variants
    : copy.alternatives.map((primaryText) => ({
        primaryText,
        headline: copy.headline,
      }));
  return drafted
    .map((v) => ({
      enabled: true,
      primaryText: v.primaryText?.trim() ?? "",
      headline: clean(v.headline) || clean(copy.headline),
      imageUrl: null,
      videoUrl: null,
    }))
    .filter((v) => v.primaryText && v.primaryText !== copy.primaryText.trim())
    .slice(0, 2);
}

export function assemblePlan(
  ctx: GenerationContext,
  copy: PlanAiResult,
  interests: { id: string; name: string }[],
): unknown {
  const goal = GOALS[ctx.input.goal];
  const callToAction =
    goal.instantForm &&
    !(LEAD_FORM_CALLS_TO_ACTION as readonly string[]).includes(
      copy.callToAction,
    )
      ? DEFAULT_CTAS[ctx.input.goal]
      : copy.callToAction;
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
    targeting: ctx.audience ?? {
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
      alternatives: [],
      headline: clean(copy.headline),
      description: clean(copy.description) || null,
      linkUrl: ctx.linkUrl,
      imageUrl: ctx.post ? null : ctx.imageUrl,
      videoUrl: ctx.post ? null : (ctx.videoUrl ?? null),
      imageIdea: clean(copy.imageIdea) || null,
      callToAction,
      post: ctx.post,
    },
    reasons: {
      goal: clean(copy.reasons.goal),
      audience: clean(copy.reasons.audience),
      budget: clean(copy.reasons.budget),
      creative: clean(copy.reasons.creative),
    },
    expectedResults: clean(copy.expectedResults) || null,
    leadForm: leadFormOf(ctx, copy, clean(copy.name) ?? ""),
    variants: variantsOf(ctx, copy),
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
