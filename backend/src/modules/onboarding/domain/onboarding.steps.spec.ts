import {
  buildView,
  completedSteps,
  OnboardingFacts,
  OnboardingStepId,
  STEPS,
} from "./onboarding.steps";

const done = (...ids: OnboardingStepId[]) =>
  new Map<OnboardingStepId, Date | null>(ids.map((id) => [id, null]));

const facts = (overrides: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  metaConnected: false,
  primaryKinds: [],
  basicsComplete: false,
  goal: null,
  budgetSet: false,
  trackingReady: false,
  plans: { planned: 0, createdInMeta: 0 },
  ...overrides,
});

describe("buildView", () => {
  it("makes the first incomplete step current", () => {
    const view = buildView(done("connect_meta"));
    expect(view.currentStep).toBe("choose_assets");
    expect(view.steps[0]!.status).toBe("completed");
    expect(view.steps[1]!.status).toBe("current");
    expect(view.steps[2]!.status).toBe("upcoming");
    expect(view.completedCount).toBe(1);
  });

  it("starts with connecting Meta and lists seven steps", () => {
    const view = buildView(done());
    expect(view.currentStep).toBe("connect_meta");
    expect(view.steps.map((s) => s.id)).toEqual([
      "connect_meta",
      "choose_assets",
      "business_profile",
      "goal_budget",
      "tracking_check",
      "campaign_plan",
      "launch",
    ]);
    expect(view.steps.every((s) => s.available)).toBe(true);
  });

  it("numbers steps in order and reports totals", () => {
    const view = buildView(done("connect_meta"));
    expect(view.steps.map((s) => s.order)).toEqual(STEPS.map((_, i) => i + 1));
    expect(view.totalCount).toBe(STEPS.length);
  });

  it("is complete when every step is done", () => {
    const view = buildView(done(...STEPS.map((s) => s.id)));
    expect(view.isComplete).toBe(true);
    expect(view.currentStep).toBeNull();
  });

  it("treats a skipped step as passed and marks it", () => {
    const view = buildView(
      done("connect_meta", "choose_assets", "business_profile", "goal_budget"),
      new Set<OnboardingStepId>(["tracking_check"]),
    );
    const tracking = view.steps.find((s) => s.id === "tracking_check")!;
    expect(tracking.status).toBe("completed");
    expect(tracking.skipped).toBe(true);
    expect(view.currentStep).toBe("campaign_plan");
  });

  it("does not mark a skipped step that later completed for real", () => {
    const view = buildView(
      done("tracking_check"),
      new Set<OnboardingStepId>(["tracking_check"]),
    );
    expect(view.steps.find((s) => s.id === "tracking_check")!.skipped).toBe(
      false,
    );
  });

  it("only lets the tracking check be skipped", () => {
    expect(STEPS.filter((s) => s.skippable).map((s) => s.id)).toEqual([
      "tracking_check",
    ]);
  });

  it("carries completion timestamps", () => {
    const at = new Date("2026-10-09T10:00:00Z");
    const view = buildView(
      new Map<OnboardingStepId, Date | null>([["connect_meta", at]]),
    );
    expect(view.steps[0]!.completedAt).toBe("2026-10-09T10:00:00.000Z");
  });
});

describe("completedSteps", () => {
  it("completes nothing for a new workspace", () => {
    expect([...completedSteps(facts())]).toEqual([]);
  });

  it("needs both an ad account and a Page to finish choosing accounts", () => {
    expect(
      completedSteps(
        facts({ metaConnected: true, primaryKinds: ["ad_account"] }),
      ).has("choose_assets"),
    ).toBe(false);
    expect(
      completedSteps(
        facts({ metaConnected: true, primaryKinds: ["ad_account", "page"] }),
      ).has("choose_assets"),
    ).toBe(true);
    expect(
      completedSteps(
        facts({ metaConnected: false, primaryKinds: ["ad_account", "page"] }),
      ).has("choose_assets"),
    ).toBe(false);
  });

  it("completes basics and goal from saved settings", () => {
    const steps = completedSteps(
      facts({ basicsComplete: true, goal: "traffic", budgetSet: true }),
    );
    expect(steps.has("business_profile")).toBe(true);
    expect(steps.has("goal_budget")).toBe(true);
    expect(
      completedSteps(facts({ goal: "traffic", budgetSet: false })).has(
        "goal_budget",
      ),
    ).toBe(false);
  });

  it("passes tracking for goals that don't need a Pixel", () => {
    expect(
      completedSteps(facts({ goal: "traffic" })).has("tracking_check"),
    ).toBe(true);
    expect(
      completedSteps(facts({ goal: "awareness" })).has("tracking_check"),
    ).toBe(true);
    expect(completedSteps(facts()).has("tracking_check")).toBe(false);
  });

  it("needs healthy tracking for leads and sales", () => {
    expect(completedSteps(facts({ goal: "leads" })).has("tracking_check")).toBe(
      false,
    );
    expect(
      completedSteps(facts({ goal: "sales", trackingReady: true })).has(
        "tracking_check",
      ),
    ).toBe(true);
  });

  it("completes the campaign steps from plans", () => {
    const drafted = completedSteps(
      facts({ plans: { planned: 1, createdInMeta: 0 } }),
    );
    expect(drafted.has("campaign_plan")).toBe(true);
    expect(drafted.has("launch")).toBe(false);
    const created = completedSteps(
      facts({ plans: { planned: 1, createdInMeta: 1 } }),
    );
    expect(created.has("launch")).toBe(true);
  });
});
