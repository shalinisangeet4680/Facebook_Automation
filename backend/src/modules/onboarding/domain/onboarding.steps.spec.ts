import { buildView, OnboardingStepId, STEPS } from "./onboarding.steps";

const done = (...ids: OnboardingStepId[]) =>
  new Map<OnboardingStepId, Date | null>(ids.map((id) => [id, null]));

describe("buildView", () => {
  it("makes the first incomplete step current", () => {
    const view = buildView(done("sign_in"));
    expect(view.currentStep).toBe("connect_meta");
    expect(view.steps[0]!.status).toBe("completed");
    expect(view.steps[1]!.status).toBe("current");
    expect(view.steps[2]!.status).toBe("upcoming");
    expect(view.completedCount).toBe(1);
  });

  it("numbers steps in order and reports totals", () => {
    const view = buildView(done("sign_in"));
    expect(view.steps.map((s) => s.order)).toEqual(STEPS.map((_, i) => i + 1));
    expect(view.totalCount).toBe(STEPS.length);
  });

  it("is complete when every step is done", () => {
    const view = buildView(done(...STEPS.map((s) => s.id)));
    expect(view.isComplete).toBe(true);
    expect(view.currentStep).toBeNull();
  });

  it("carries completion timestamps", () => {
    const at = new Date("2026-10-09T10:00:00Z");
    const view = buildView(
      new Map<OnboardingStepId, Date | null>([
        ["sign_in", null],
        ["connect_meta", at],
      ]),
    );
    expect(view.steps[1]!.completedAt).toBe("2026-10-09T10:00:00.000Z");
  });
});
