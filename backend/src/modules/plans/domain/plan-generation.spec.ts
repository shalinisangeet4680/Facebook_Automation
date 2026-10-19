import {
  agesFrom,
  buildPlan,
  clampBudget,
  draftPlanCopy,
  GenerationContext,
  gendersFrom,
  interestHints,
  templatePlan,
} from "./plan-generation";
import { parsePlan } from "./plan.schema";
import { PlanAiInput } from "./ports/plan-ai";

function input(overrides: Partial<PlanAiInput> = {}): PlanAiInput {
  return {
    goal: "leads",
    offer: "Free skin consultation for new clients",
    audienceNotes: "women 25–45 interested in skincare and yoga",
    landingUrl: "https://glow.example.com/book",
    language: null,
    dailyBudget: 500,
    requestedDailyBudget: 500,
    currency: "INR",
    maxDailyBudget: 3000,
    targetCostPerResult: 200,
    locations: ["Patna", "Bihar"],
    ageMin: null,
    ageMax: null,
    hasVisual: false,
    business: {
      name: "Glow Clinic",
      page: "Glow Clinic Patna",
      instagram: null,
      pixel: true,
      pixelEvents: ["Lead"],
      website: null,
      sells: null,
      area: null,
      category: null,
    },
    pastCampaigns: [],
    leadForm: null,
    ...overrides,
  };
}

function context(overrides: Partial<PlanAiInput> = {}): GenerationContext {
  return {
    leadForm: null,
    input: input(overrides),
    locations: {
      countries: [],
      regions: [{ key: "1730", name: "Bihar" }],
      cities: [{ key: "1035921", name: "Patna", radiusKm: 25 }],
    },
    linkUrl: "https://glow.example.com/book",
    imageUrl: null,
    post: null,
  };
}

describe("clampBudget", () => {
  it("keeps budgets under the limit and lowers budgets above it", () => {
    expect(clampBudget(500, 3000)).toEqual({
      dailyBudget: 500,
      clamped: false,
    });
    expect(clampBudget(4500, 3000)).toEqual({
      dailyBudget: 3000,
      clamped: true,
    });
    expect(clampBudget(99.999, 3000)).toEqual({
      dailyBudget: 100,
      clamped: false,
    });
  });
});

describe("audience hints", () => {
  it("reads interests, gender and ages from plain notes", () => {
    const notes = "women 25–45 interested in skincare and yoga";
    expect(interestHints(notes)).toEqual(["skincare", "yoga"]);
    expect(gendersFrom(notes)).toBe("female");
    expect(agesFrom(notes)).toEqual({ ageMin: 25, ageMax: 45 });
    expect(gendersFrom("men and women who love cricket")).toBe("all");
    expect(agesFrom("teens 13 to 70")).toEqual({ ageMin: 18, ageMax: 65 });
    expect(interestHints(null)).toEqual([]);
  });
});

describe("draftPlanCopy", () => {
  it("writes a complete, valid plan without AI", () => {
    const ctx = context();
    const built = buildPlan(ctx, draftPlanCopy(ctx.input), []);
    expect(built.usedTemplate).toBe(false);
    expect(built.plan).toMatchObject({
      goal: "leads",
      conversionEvent: "LEAD",
      dailyBudget: 500,
      targeting: { ageMin: 25, ageMax: 45, genders: "female" },
      creative: {
        callToAction: "SIGN_UP",
        linkUrl: "https://glow.example.com/book",
      },
    });
    expect(built.plan.reasons.budget).toContain("₹500 a day");
    expect(built.plan.expectedResults).toContain("Roughly 18 results a week");
  });

  it("explains a budget that was lowered to the limit", () => {
    const copy = draftPlanCopy(
      input({ dailyBudget: 3000, requestedDailyBudget: 9000 }),
    );
    expect(copy.reasons.budget).toContain("above your limit");
  });
});

describe("buildPlan fallback", () => {
  it("falls back to the template when the AI output is not a valid plan", () => {
    const ctx = context();
    const good = draftPlanCopy(ctx.input);
    const bad = {
      ...good,
      headline: "   ",
      callToAction: "CALL_NOW_PLEASE",
      ageMin: 70,
      ageMax: 12,
      reasons: { ...good.reasons, goal: "" },
    };
    const built = buildPlan(ctx, bad, [{ id: "6003", name: "Yoga" }]);
    expect(built.usedTemplate).toBe(true);
    expect(built.problem).toBeTruthy();
    expect(built.plan).toEqual(templatePlan(ctx));
    expect(parsePlan(built.plan).ok).toBe(true);
    expect(built.plan.dailyBudget).toBe(500);
    expect(built.plan.targeting.interests).toEqual([]);
    expect(built.plan.targeting.regions).toEqual([
      { key: "1730", name: "Bihar" },
    ]);
  });

  it("falls back when the AI output is missing fields entirely", () => {
    const ctx = context({ goal: "traffic" });
    const built = buildPlan(
      ctx,
      { name: "x" } as unknown as ReturnType<typeof draftPlanCopy>,
      [],
    );
    expect(built.usedTemplate).toBe(true);
    expect(built.plan.goal).toBe("traffic");
    expect(built.plan.conversionEvent).toBeNull();
    expect(built.plan.creative.callToAction).toBe("LEARN_MORE");
  });

  it("keeps the owner's choices over the AI's", () => {
    const ctx = context({ ageMin: 30, ageMax: 50 });
    ctx.post = { platform: "instagram", id: "17900000000000001" };
    ctx.imageUrl = "https://glow.example.com/ad.png";
    const copy = { ...draftPlanCopy(ctx.input), ageMin: 18, ageMax: 65 };
    const built = buildPlan(ctx, copy, []);
    expect(built.usedTemplate).toBe(false);
    expect(built.plan.targeting).toMatchObject({ ageMin: 30, ageMax: 50 });
    expect(built.plan.creative.imageUrl).toBeNull();
    expect(built.plan.creative.post?.id).toBe("17900000000000001");
  });
});

describe("instant form plans", () => {
  function instant(): GenerationContext {
    const ctx = context({
      goal: "instant_leads",
      language: "Hindi",
      leadForm: {
        questions: ["FULL_NAME", "PHONE", "CITY"],
        extraQuestions: true,
        button: "website",
      },
    });
    ctx.imageUrl = "https://glow.example.com/ad.png";
    ctx.leadForm = {
      questions: ["FULL_NAME", "PHONE", "CITY"],
      privacyPolicyUrl: "https://glow.example.com/privacy",
      locale: "HI_IN",
      button: { type: "website", url: "https://glow.example.com/book" },
    };
    return ctx;
  }

  it("drafts a complete lead form without AI", () => {
    const ctx = instant();
    const built = buildPlan(ctx, draftPlanCopy(ctx.input), []);
    expect(built.usedTemplate).toBe(false);
    expect(built.plan).toMatchObject({
      goal: "instant_leads",
      conversionEvent: null,
      creative: { callToAction: "SIGN_UP" },
      leadForm: {
        locale: "HI_IN",
        questions: ["FULL_NAME", "PHONE", "CITY"],
        privacyPolicyUrl: "https://glow.example.com/privacy",
        intro: { headline: "Free skin consultation for new clients" },
        thankYou: {
          button: {
            type: "website",
            text: "Visit website",
            url: "https://glow.example.com/book",
          },
        },
      },
    });
    expect(built.plan.leadForm?.customQuestions).toEqual([
      {
        label: "When is the best time to call you?",
        type: "multiple_choice",
        options: ["Morning", "Afternoon", "Evening"],
      },
    ]);
    expect(built.plan.reasons.goal).toContain("no website or Pixel");
  });

  it("repairs AI form copy instead of dropping the plan", () => {
    const ctx = instant();
    const copy = draftPlanCopy(ctx.input);
    const built = buildPlan(
      ctx,
      {
        ...copy,
        callToAction: "SHOP_NOW",
        leadForm: {
          ...copy.leadForm!,
          headline: "x".repeat(120),
          customQuestions: [
            { label: "Budget?", type: "multiple_choice", options: ["Low"] },
            { label: "Anything else?", type: "short_answer", options: [] },
            { label: "Q3", type: "short_answer", options: [] },
            { label: "Q4", type: "short_answer", options: [] },
          ],
        },
      },
      [],
    );
    expect(built.usedTemplate).toBe(false);
    expect(built.plan.creative.callToAction).toBe("SIGN_UP");
    expect(built.plan.leadForm?.intro.headline.length).toBeLessThanOrEqual(60);
    expect(built.plan.leadForm?.customQuestions).toHaveLength(3);
    expect(built.plan.leadForm?.customQuestions[0]).toEqual({
      label: "Budget?",
      type: "short_answer",
      options: [],
    });
  });

  it("skips custom questions when the owner doesn't want them", () => {
    const ctx = instant();
    ctx.input.leadForm!.extraQuestions = false;
    const built = buildPlan(ctx, draftPlanCopy(ctx.input), []);
    expect(built.plan.leadForm?.customQuestions).toEqual([]);
  });
});
