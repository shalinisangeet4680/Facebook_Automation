import { formatMoney } from "./money";

export interface DailyBudgetCheck {
  amount: number;
  current: number | null;
  currency: string;
  maxDailyBudget: number;
  monthly: {
    budget: number;
    spentSoFar: number;
    otherDailyBudgets: number;
    daysLeft: number;
  } | null;
}

export type DailyBudgetVerdict =
  | { ok: true; warnings: string[]; projectedMonthSpend: number | null }
  | {
      ok: false;
      reason: "not_positive" | "over_daily_limit" | "over_monthly_budget";
      message: string;
      projectedMonthSpend: number | null;
    };

const round = (n: number) => Math.round(n * 100) / 100;

export function projectMonthSpend(
  amount: number,
  monthly: NonNullable<DailyBudgetCheck["monthly"]>,
): number {
  return round(
    monthly.spentSoFar +
      (monthly.otherDailyBudgets + amount) * Math.max(monthly.daysLeft, 0),
  );
}

export function checkDailyBudget(input: DailyBudgetCheck): DailyBudgetVerdict {
  const money = (v: number) => formatMoney(v, input.currency);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return {
      ok: false,
      reason: "not_positive",
      message: "The daily budget must be more than 0.",
      projectedMonthSpend: null,
    };
  }
  if (input.amount > input.maxDailyBudget) {
    return {
      ok: false,
      reason: "over_daily_limit",
      message: `Daily budget ${money(input.amount)} is above this workspace's limit of ${money(input.maxDailyBudget)} a day. Lower it, or raise the limit in Settings.`,
      projectedMonthSpend: null,
    };
  }
  if (!input.monthly) {
    return { ok: true, warnings: [], projectedMonthSpend: null };
  }
  const projected = projectMonthSpend(input.amount, input.monthly);
  if (projected <= input.monthly.budget) {
    return { ok: true, warnings: [], projectedMonthSpend: projected };
  }
  const increasing = input.current === null || input.amount > input.current;
  const over = `At ${money(input.amount)} a day you're on track to spend about ${money(projected)} this month, above your monthly budget of ${money(input.monthly.budget)}.`;
  if (increasing) {
    return {
      ok: false,
      reason: "over_monthly_budget",
      message: `${over} Choose a lower amount, or raise the monthly budget in Settings.`,
      projectedMonthSpend: projected,
    };
  }
  return {
    ok: true,
    warnings: [`${over} Consider lowering other budgets too.`],
    projectedMonthSpend: projected,
  };
}
