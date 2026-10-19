import { z } from "zod";

const named = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
});
const keyed = z.object({
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
});
const customAudience = z.object({
  id: z.string().regex(/^\d{5,30}$/),
  name: z.string().min(1).max(200),
});

export const MAX_SAVED_AUDIENCES = 100;

export const targetingSchema = z
  .object({
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
    interests: z.array(named).max(25).default([]),
    workPositions: z.array(named).max(25).default([]),
    industries: z.array(named).max(25).default([]),
    behaviors: z.array(named).max(25).default([]),
    customAudiences: z.array(customAudience).max(10).default([]),
    excludedCustomAudiences: z.array(customAudience).max(10).default([]),
  })
  .superRefine((t, ctx) => {
    if (t.ageMin > t.ageMax)
      ctx.addIssue({
        code: "custom",
        message: "ageMin must be less than or equal to ageMax",
        path: ["ageMin"],
      });
    const included = new Set(t.customAudiences.map((a) => a.id));
    if (t.excludedCustomAudiences.some((a) => included.has(a.id)))
      ctx.addIssue({
        code: "custom",
        message: "An audience can't be both included and excluded",
        path: ["excludedCustomAudiences"],
      });
  });

export type PlanTargeting = z.infer<typeof targetingSchema>;

export const savedAudienceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targeting: targetingSchema,
});

export type SavedAudienceInput = z.infer<typeof savedAudienceSchema>;

export function parseAudience(
  input: unknown,
): { ok: true; audience: SavedAudienceInput } | { ok: false; message: string } {
  const result = savedAudienceSchema.safeParse(input);
  if (result.success) return { ok: true, audience: result.data };
  return {
    ok: false,
    message: result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "audience"}: ${i.message}`)
      .join("; "),
  };
}

export function hasLocation(t: PlanTargeting): boolean {
  return Boolean(t.countries.length || t.regions.length || t.cities.length);
}
