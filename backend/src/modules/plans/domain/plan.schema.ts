import { z } from "zod";

import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOAL_NAMES,
} from "@modules/ads/domain/goals";

const reason = z.string().trim().min(1).max(1200);
const keyed = z.object({
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
});

export const planSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    summary: z.string().trim().min(1).max(2000),
    goal: z.enum(GOAL_NAMES as [string, ...string[]]),
    conversionEvent: z.enum(CONVERSION_EVENTS).nullable().optional(),
    dailyBudget: z.number().positive().max(10_000_000),
    targeting: z.object({
      countries: z.array(z.string().length(2)).max(25).default([]),
      regions: z.array(keyed).max(50).default([]),
      cities: z
        .array(
          keyed.extend({
            radiusKm: z.number().min(10).max(80).nullable().optional(),
          }),
        )
        .max(250)
        .default([]),
      ageMin: z.number().int().min(18).max(65),
      ageMax: z.number().int().min(18).max(65),
      genders: z.enum(["all", "male", "female"]).default("all"),
      interests: z
        .array(
          z.object({
            id: z.string().min(1).max(40),
            name: z.string().min(1).max(200),
          }),
        )
        .max(25)
        .default([]),
    }),
    creative: z.object({
      primaryText: z.string().trim().min(1).max(2000),
      alternatives: z
        .array(z.string().trim().min(1).max(2000))
        .max(5)
        .default([]),
      headline: z.string().trim().min(1).max(255),
      description: z.string().trim().max(255).nullable().optional(),
      linkUrl: z.string().url().startsWith("https://"),
      imageUrl: z.string().url().startsWith("https://").nullable().optional(),
      imageIdea: z.string().trim().max(500).nullable().optional(),
      callToAction: z.enum(CALLS_TO_ACTION),
      post: z
        .object({
          platform: z.enum(["facebook", "instagram"]),
          id: z.string().min(1).max(80),
          permalink: z.string().url().nullable().optional(),
          imageUrl: z.string().url().nullable().optional(),
          text: z.string().max(5000).nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
    reasons: z.object({
      goal: reason,
      audience: reason,
      budget: reason,
      creative: reason,
    }),
    expectedResults: z.string().trim().max(500).nullable().optional(),
  })
  .refine((p) => p.targeting.ageMin <= p.targeting.ageMax, {
    message: "ageMin must be less than or equal to ageMax",
    path: ["targeting", "ageMin"],
  });

export type CampaignPlan = z.infer<typeof planSchema>;

export function parsePlan(
  input: unknown,
): { ok: true; plan: CampaignPlan } | { ok: false; message: string } {
  const result = planSchema.safeParse(input);
  if (result.success) return { ok: true, plan: result.data };
  const message = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "plan"}: ${i.message}`)
    .join("; ");
  return { ok: false, message };
}
