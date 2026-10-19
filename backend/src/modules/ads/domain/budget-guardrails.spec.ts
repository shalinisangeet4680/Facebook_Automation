import { checkDailyBudget, projectMonthSpend } from "./budget-guardrails";

const base = {
  amount: 1000,
  current: 800,
  currency: "INR",
  maxDailyBudget: 5000,
  monthly: null,
};

describe("daily budget guardrails", () => {
  it("rejects zero, negative and non-numeric budgets", () => {
    for (const amount of [0, -50, Number.NaN]) {
      expect(checkDailyBudget({ ...base, amount })).toMatchObject({
        ok: false,
        reason: "not_positive",
      });
    }
  });

  it("caps at the workspace daily limit", () => {
    const verdict = checkDailyBudget({ ...base, amount: 6000 });
    expect(verdict).toMatchObject({ ok: false, reason: "over_daily_limit" });
    expect(!verdict.ok && verdict.message).toContain("₹5,000");
    expect(checkDailyBudget({ ...base, amount: 5000 }).ok).toBe(true);
  });

  it("projects the month from spend so far plus every running budget", () => {
    expect(
      projectMonthSpend(1000, {
        budget: 50_000,
        spentSoFar: 12_000,
        otherDailyBudgets: 500,
        daysLeft: 10,
      }),
    ).toBe(27_000);
  });

  it("rejects an increase that would overshoot the monthly budget", () => {
    const verdict = checkDailyBudget({
      ...base,
      amount: 1500,
      monthly: {
        budget: 20_000,
        spentSoFar: 10_000,
        otherDailyBudgets: 0,
        daysLeft: 10,
      },
    });
    expect(verdict).toMatchObject({
      ok: false,
      reason: "over_monthly_budget",
      projectedMonthSpend: 25_000,
    });
    expect(!verdict.ok && verdict.message).toContain("₹20,000");
  });

  it("allows a decrease even when the month is already over, with a warning", () => {
    const verdict = checkDailyBudget({
      ...base,
      amount: 600,
      current: 800,
      monthly: {
        budget: 10_000,
        spentSoFar: 9_000,
        otherDailyBudgets: 0,
        daysLeft: 5,
      },
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.warnings[0]).toContain("monthly budget");
  });

  it("passes quietly within the monthly budget", () => {
    expect(
      checkDailyBudget({
        ...base,
        monthly: {
          budget: 40_000,
          spentSoFar: 5_000,
          otherDailyBudgets: 200,
          daysLeft: 20,
        },
      }),
    ).toEqual({ ok: true, warnings: [], projectedMonthSpend: 29_000 });
  });
});
