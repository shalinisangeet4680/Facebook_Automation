import { z } from "zod";

import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOAL_NAMES,
  GOALS,
  Goal,
  LEAD_FORM_CALLS_TO_ACTION,
} from "@modules/ads/domain/goals";
import { targetingSchema } from "@modules/ads/domain/audience";
import { leadFormSchema } from "@modules/ads/domain/lead-form";

const reason = z.string().trim().min(1).max(1200);
const https = z.string().url().startsWith("https://");

export const MAX_EXTRA_VARIANTS = 2;

export const variantSchema = z.object({
  enabled: z.boolean().default(true),
  primaryText: z.string().trim().min(1).max(2000),
  headline: z.string().trim().min(1).max(255),
  imageUrl: https.nullable().optional(),
  videoUrl: https.nullable().optional(),
});

export type PlanVariant = z.infer<typeof variantSchema>;

export const planSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    summary: z.string().trim().min(1).max(2000),
    goal: z.enum(GOAL_NAMES as [string, ...string[]]),
    conversionEvent: z.enum(CONVERSION_EVENTS).nullable().optional(),
    dailyBudget: z.number().positive().max(10_000_000),
    targeting: targetingSchema,
    creative: z.object({
      primaryText: z.string().trim().min(1).max(2000),
      alternatives: z
        .array(z.string().trim().min(1).max(2000))
        .max(5)
        .default([]),
      headline: z.string().trim().min(1).max(255),
      description: z.string().trim().max(255).nullable().optional(),
      linkUrl: z.string().url().startsWith("https://"),
      imageUrl: https.nullable().optional(),
      videoUrl: https.nullable().optional(),
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
    leadForm: leadFormSchema.nullable().optional(),
    variants: z.array(variantSchema).max(MAX_EXTRA_VARIANTS).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.creative.post && p.creative.videoUrl)
      ctx.addIssue({
        code: "custom",
        message: "Choose either a video or an existing post, not both",
        path: ["creative", "videoUrl"],
      });
    if (p.creative.post && p.variants.some((v) => v.enabled))
      ctx.addIssue({
        code: "custom",
        message:
          "Ads made from an existing post can't be tested in versions. Turn the versions off or use an image or video",
        path: ["variants"],
      });
    p.variants.forEach((v, i) => {
      if (v.imageUrl && v.videoUrl)
        ctx.addIssue({
          code: "custom",
          message: "Choose either an image or a video for this version",
          path: ["variants", i, "videoUrl"],
        });
    });
    if (!GOALS[p.goal as Goal].instantForm) return;
    if (!p.leadForm)
      ctx.addIssue({
        code: "custom",
        message: "Instant form ads need a lead form",
        path: ["leadForm"],
      });
    if (p.creative.post)
      ctx.addIssue({
        code: "custom",
        message:
          "Instant form ads need an image or a video, not an existing post. Remove the post and add an image or video",
        path: ["creative", "post"],
      });
    if (
      !(LEAD_FORM_CALLS_TO_ACTION as readonly string[]).includes(
        p.creative.callToAction,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: `Instant forms use one of these buttons: ${LEAD_FORM_CALLS_TO_ACTION.join(", ")}`,
        path: ["creative", "callToAction"],
      });
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
