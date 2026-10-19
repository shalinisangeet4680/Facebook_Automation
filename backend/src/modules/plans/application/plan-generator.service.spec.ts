import { AdsService } from "@modules/ads/application/ads.service";
import { AuditService } from "@modules/audit/application/audit.service";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { SettingsService } from "@modules/settings/application/settings.service";

import { CampaignPlan, parsePlan } from "../domain/plan.schema";
import { PlanAi, PlanAiInput, PlanAiResult } from "../domain/ports/plan-ai";
import { PlanGeneratorService } from "./plan-generator.service";
import { PlanService } from "./plan.service";

const actor = { userId: "u1", workspaceId: "w1", via: "app" };

function setup(ai: PlanAi) {
  const proposed: { plan: CampaignPlan; details: Record<string, unknown> }[] =
    [];
  const plans = {
    propose: vi.fn((_a: unknown, plan: CampaignPlan, details) => {
      proposed.push({ plan, details: details as Record<string, unknown> });
      return Promise.resolve({ id: "p1" });
    }),
  } as unknown as PlanService;
  const ads = {
    account: () =>
      Promise.resolve({
        currency: "INR",
        page: { externalId: "1001", name: "Glow Clinic" },
        instagram: null,
        business: null,
        dataset: null,
      }),
    planningContext: () => Promise.reject(new Error("Meta is down")),
    searchTargeting: (_ws: string, _type: string, q: string) =>
      Promise.resolve({
        results:
          q === "yoga"
            ? [
                {
                  key: "6003306084421",
                  name: "Yoga",
                  type: "interest",
                  region: null,
                  countryCode: null,
                  audienceSize: 1,
                },
              ]
            : [],
      }),
  } as unknown as AdsService;
  const settings = {
    targets: () =>
      Promise.resolve({
        maxDailyBudget: 1000,
        monthlyBudget: null,
        targetCostPerResult: null,
      }),
    profile: () =>
      Promise.resolve({
        basics: {
          websiteUrl: "https://glowclinic.in",
          offer: "Skin and hair treatments",
          area: "Patna",
          category: "Clinic",
          language: "Hinglish",
        },
        basicsComplete: true,
        goal: "leads",
        budgetSet: true,
      }),
  } as unknown as SettingsService;
  const workspaceAi = {
    registerDraftCounter: vi.fn(),
    settings: () => Promise.resolve(null),
    keyFrom: () => "key",
    allowance: () => Promise.resolve(10),
  } as unknown as WorkspaceAiService;
  const service = new PlanGeneratorService(
    plans,
    ads,
    settings,
    {} as CreativesService,
    workspaceAi,
    {} as AuditService,
    ai,
  );
  return { service, proposed };
}

const request = {
  goal: "awareness" as const,
  dailyBudget: 2500,
  locations: {
    countries: ["IN"],
    regions: [],
    cities: [],
  },
  audienceNotes: "people who love yoga",
  offer: "New morning yoga batch",
};

describe("PlanGeneratorService", () => {
  it("saves a safe template plan when the AI returns an invalid plan", async () => {
    const invalid: PlanAiResult = {
      name: "",
      summary: "",
      conversionEvent: null,
      ageMin: 10,
      ageMax: 99,
      genders: "all",
      interests: ["yoga"],
      primaryText: "",
      alternatives: [],
      headline: "",
      description: null,
      callToAction: "NOPE",
      imageIdea: null,
      reasons: { goal: "", audience: "", budget: "", creative: "" },
      expectedResults: null,
      leadForm: null,
    };
    const { service, proposed } = setup({
      write: () => Promise.resolve(invalid),
    });
    const result = await service.generate(actor, request);
    expect(result).toMatchObject({
      id: "p1",
      ai: true,
      usedTemplate: true,
      budgetClamped: true,
      dailyBudget: 1000,
    });
    const saved = proposed[0]!;
    expect(parsePlan(saved.plan).ok).toBe(true);
    expect(saved.plan.dailyBudget).toBe(1000);
    expect(saved.plan.creative.linkUrl).toBe("https://www.facebook.com/1001");
    expect(saved.plan.reasons.budget).toContain("above your limit");
    expect(saved.details).toMatchObject({
      generated: true,
      ai: true,
      usedTemplate: true,
    });
  });

  it("writes the plan without AI when the provider fails", async () => {
    const { service, proposed } = setup({
      write: () => Promise.reject(new Error("overloaded")),
    });
    const result = await service.generate(actor, request);
    expect(result).toMatchObject({ ai: false, usedTemplate: false });
    expect(proposed[0]!.plan.targeting.interests).toEqual([
      { id: "6003306084421", name: "Yoga" },
    ]);
  });

  it("rejects a zero budget and website goals without a link", async () => {
    const { service } = setup({ write: () => Promise.reject(new Error()) });
    await expect(
      service.generate(actor, { ...request, dailyBudget: 0 }),
    ).rejects.toThrow("above zero");
    await expect(
      service.generate(actor, { ...request, goal: "sales" }),
    ).rejects.toThrow("web page");
  });

  it("gives the AI the saved business basics and ad language", async () => {
    const write = vi.fn((_key: string, _input: PlanAiInput) =>
      Promise.reject(new Error("overloaded")),
    );
    const { service } = setup({ write });
    await service.generate(actor, request);
    const input = write.mock.calls[0]![1];
    expect(input.language).toBe("Hinglish");
    expect(input.business).toMatchObject({
      website: "https://glowclinic.in",
      sells: "Skin and hair treatments",
      area: "Patna",
      category: "Clinic",
    });
    await service.generate(actor, { ...request, language: "English" });
    expect(write.mock.calls[1]![1].language).toBe("English");
  });

  it("builds an instant form from the website's privacy page", async () => {
    const write = vi.fn((_key: string, _input: PlanAiInput) =>
      Promise.reject(new Error("overloaded")),
    );
    const { service, proposed } = setup({ write });
    await service.generate(actor, {
      ...request,
      goal: "instant_leads",
      creative: { imageUrl: "https://glowclinic.in/ad.png" },
    });
    expect(write.mock.calls[0]![1].leadForm).toEqual({
      questions: ["FULL_NAME", "PHONE", "CITY"],
      extraQuestions: true,
      button: "website",
    });
    const plan = proposed[0]!.plan;
    expect(plan.goal).toBe("instant_leads");
    expect(plan.leadForm).toMatchObject({
      privacyPolicyUrl: "https://glowclinic.in/privacy",
      questions: ["FULL_NAME", "PHONE", "CITY"],
      thankYou: { button: { type: "website", url: "https://glowclinic.in" } },
    });
  });

  it("asks for a privacy policy, a contact question and an image for instant forms", async () => {
    const { service } = setup({ write: () => Promise.reject(new Error()) });
    const noSite = new PlanGeneratorService(
      { propose: vi.fn() } as unknown as PlanService,
      {
        account: () =>
          Promise.resolve({
            currency: "INR",
            page: { externalId: "1001", name: "Glow" },
            instagram: null,
            business: null,
            dataset: null,
          }),
        planningContext: () => Promise.reject(new Error("down")),
        searchTargeting: () => Promise.resolve({ results: [] }),
      } as unknown as AdsService,
      {
        targets: () =>
          Promise.resolve({
            maxDailyBudget: 1000,
            monthlyBudget: null,
            targetCostPerResult: null,
          }),
        profile: () =>
          Promise.resolve({
            basics: {
              websiteUrl: null,
              offer: null,
              area: null,
              category: null,
              language: null,
            },
          }),
      } as unknown as SettingsService,
      {} as CreativesService,
      {
        registerDraftCounter: vi.fn(),
        settings: () => Promise.resolve(null),
        keyFrom: () => null,
        allowance: () => Promise.resolve(0),
      } as unknown as WorkspaceAiService,
      {} as AuditService,
      { write: () => Promise.reject(new Error()) },
    );
    await expect(
      noSite.generate(actor, { ...request, goal: "instant_leads" }),
    ).rejects.toThrow("privacy policy");
    await expect(
      service.generate(actor, {
        ...request,
        goal: "instant_leads",
        leadForm: { questions: ["FULL_NAME", "CITY"] },
      }),
    ).rejects.toThrow("phone number or an email");
    await expect(
      service.generate(actor, {
        ...request,
        goal: "instant_leads",
        creative: { post: { platform: "facebook", id: "1_2" } },
      }),
    ).rejects.toThrow("image, not an existing post");
  });
});
