import { AdInput, evaluate, Metrics, RuleInput } from "./rules";

const metrics = (m: Partial<Metrics>): Metrics => ({
  spend: 0,
  results: 0,
  impressions: 10_000,
  linkClicks: 100,
  landingPageViews: 80,
  frequency: 1.5,
  ...m,
});

const ad = (
  id: string,
  current: Partial<Metrics>,
  extra: Partial<AdInput> = {},
): AdInput => ({
  id,
  name: `Ad ${id}`,
  adSetId: "s1",
  active: true,
  current: metrics(current),
  previous: null,
  ...extra,
});

const base = (patch: Partial<RuleInput> = {}): RuleInput => ({
  currency: "INR",
  targetCostPerResult: 200,
  maxDailyBudget: 10_000,
  ads: [],
  adSets: [],
  conversionCampaignActive: false,
  pixelEventsLast24h: 10,
  monthlyBudget: null,
  monthSpend: 0,
  dayOfMonth: 15,
  daysInMonth: 30,
  ...patch,
});

const rules = (input: RuleInput) =>
  evaluate(input).map((f) => `${f.rule}:${f.entityId}`);

describe("inbox rules", () => {
  it("pauses ads that spent twice the target with no results", () => {
    const found = evaluate(
      base({
        ads: [
          ad("a1", { spend: 450, results: 0 }),
          ad("a2", { spend: 900, results: 6 }),
        ],
      }),
    );
    expect(found.map((f) => f.rule)).toEqual(["no_results"]);
    expect(found[0]!.action).toEqual({ type: "pause", id: "a1" });
    expect(found[0]!.title).toContain("₹450");
  });

  it("flags expensive ads only when a clearly cheaper ad in the ad set keeps running", () => {
    const expensive = ad("a1", { spend: 1200, results: 3 });
    expect(
      rules(base({ ads: [expensive, ad("a2", { spend: 600, results: 4 })] })),
    ).toEqual(["expensive:a1"]);
    expect(rules(base({ ads: [expensive] }))).toEqual([]);
    expect(
      rules(base({ ads: [expensive, ad("a2", { spend: 1100, results: 3 })] })),
    ).toEqual([]);
  });

  it("warns at ad set level when the whole ad set is above target", () => {
    const set = {
      id: "s1",
      name: "Patna",
      active: true,
      dailyBudget: 800,
      days: 7,
      current: metrics({ spend: 4000, results: 10 }),
    };
    expect(rules(base({ adSets: [set] }))).toEqual(["above_target:s1"]);
    expect(rules(base({ adSets: [set], targetCostPerResult: null }))).toEqual(
      [],
    );
  });

  it("uses the account average when there is no target", () => {
    const input = base({
      targetCostPerResult: null,
      ads: [
        ad("a1", { spend: 1500, results: 3 }),
        ad("a2", { spend: 600, results: 6 }),
        ad("a3", { spend: 600, results: 6 }),
      ],
    });
    expect(rules(input)).toEqual(["expensive:a1"]);
  });

  it("detects creative fatigue from frequency and falling CTR", () => {
    const tired = ad(
      "a1",
      {
        spend: 400,
        results: 2,
        frequency: 4.1,
        impressions: 20_000,
        linkClicks: 120,
      },
      {
        previous: metrics({ impressions: 20_000, linkClicks: 260 }),
      },
    );
    expect(rules(base({ ads: [tired] }))).toEqual(["fatigue:a1"]);
  });

  it("warns when clicks don't reach the landing page", () => {
    expect(
      rules(
        base({
          ads: [
            ad("a1", {
              spend: 300,
              results: 2,
              linkClicks: 120,
              landingPageViews: 40,
            }),
          ],
        }),
      ),
    ).toEqual(["landing_drop:a1"]);
  });

  it("suggests scaling a cheap ad set that spends its budget, within the guardrail", () => {
    const set = {
      id: "s1",
      name: "Patna",
      active: true,
      dailyBudget: 800,
      days: 7,
      current: metrics({ spend: 5400, results: 45 }),
    };
    const found = evaluate(base({ adSets: [set] }));
    expect(found[0]!.action).toEqual({
      type: "set_daily_budget",
      id: "s1",
      from: 800,
      to: 960,
    });
    expect(evaluate(base({ adSets: [set], maxDailyBudget: 800 }))).toEqual([]);
    expect(
      evaluate(
        base({
          adSets: [{ ...set, current: metrics({ spend: 2000, results: 20 }) }],
        }),
      ),
    ).toEqual([]);
  });

  it("raises a critical alert when the Pixel goes silent during a conversion campaign", () => {
    const found = evaluate(
      base({
        conversionCampaignActive: true,
        pixelEventsLast24h: 0,
        ads: [ad("a1", { spend: 100, results: 1 })],
      }),
    );
    expect(found[0]).toMatchObject({
      rule: "tracking_silent",
      severity: "critical",
    });
    expect(
      rules(base({ conversionCampaignActive: false, pixelEventsLast24h: 0 })),
    ).toEqual([]);
  });

  it("projects monthly spend against the monthly budget", () => {
    expect(
      rules(
        base({ monthlyBudget: 20_000, monthSpend: 12_000, dayOfMonth: 15 }),
      ),
    ).toEqual(["pacing:account"]);
    expect(
      rules(
        base({ monthlyBudget: 30_000, monthSpend: 12_000, dayOfMonth: 15 }),
      ),
    ).toEqual([]);
    expect(
      rules(base({ monthlyBudget: 1_000, monthSpend: 900, dayOfMonth: 2 })),
    ).toEqual([]);
  });
});
