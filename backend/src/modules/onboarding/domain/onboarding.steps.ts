import { Goal, GOALS } from "@modules/ads/domain/goals";

export type OnboardingStepId =
  | "connect_meta"
  | "choose_assets"
  | "business_profile"
  | "goal_budget"
  | "tracking_check"
  | "campaign_plan"
  | "launch";

export interface StepDefinition {
  id: OnboardingStepId;
  title: string;
  description: string;
  available: boolean;
  skippable: boolean;
}

export const STEPS: StepDefinition[] = [
  {
    id: "connect_meta",
    title: "Connect Meta",
    description: "Link your Meta business so we can manage ads for you.",
    available: true,
    skippable: false,
  },
  {
    id: "choose_assets",
    title: "Choose your accounts",
    description:
      "Pick the ad account, Facebook Page, Instagram account and Pixel to use.",
    available: true,
    skippable: false,
  },
  {
    id: "business_profile",
    title: "Business basics",
    description:
      "Your website, what you sell, where your customers are and the language for ads.",
    available: true,
    skippable: false,
  },
  {
    id: "goal_budget",
    title: "Goal and budget",
    description:
      "What you want from ads, a comfortable daily budget and a monthly cap.",
    available: true,
    skippable: false,
  },
  {
    id: "tracking_check",
    title: "Tracking check",
    description: "Make sure your Pixel records the results your goal needs.",
    available: true,
    skippable: true,
  },
  {
    id: "campaign_plan",
    title: "First campaign",
    description:
      "Answer a few questions and AI builds your first campaign plan.",
    available: true,
    skippable: false,
  },
  {
    id: "launch",
    title: "Review and launch",
    description:
      "Check the plan, create it in Meta and launch when you're ready.",
    available: true,
    skippable: false,
  },
];

export const SKIPPABLE_STEPS = STEPS.filter((s) => s.skippable).map(
  (s) => s.id,
);

export interface OnboardingFacts {
  metaConnected: boolean;
  primaryKinds: string[];
  basicsComplete: boolean;
  goal: Goal | null;
  budgetSet: boolean;
  trackingReady: boolean;
  plans: { planned: number; createdInMeta: number };
}

export const REQUIRED_PRIMARY = ["ad_account", "page"] as const;

export function goalNeedsTracking(goal: Goal | null): boolean {
  return goal !== null && GOALS[goal].needsPixel;
}

export function completedSteps(facts: OnboardingFacts): Set<OnboardingStepId> {
  const done = new Set<OnboardingStepId>();
  if (facts.metaConnected) done.add("connect_meta");
  if (
    facts.metaConnected &&
    REQUIRED_PRIMARY.every((k) => facts.primaryKinds.includes(k))
  )
    done.add("choose_assets");
  if (facts.basicsComplete) done.add("business_profile");
  if (facts.goal && facts.budgetSet) done.add("goal_budget");
  if (
    facts.goal !== null &&
    (!goalNeedsTracking(facts.goal) || facts.trackingReady)
  )
    done.add("tracking_check");
  if (facts.plans.planned > 0) done.add("campaign_plan");
  if (facts.plans.createdInMeta > 0) done.add("launch");
  return done;
}

export type StepStatus = "completed" | "current" | "upcoming";

export interface OnboardingStepView extends StepDefinition {
  order: number;
  status: StepStatus;
  skipped: boolean;
  completedAt: string | null;
}

export interface OnboardingView {
  steps: OnboardingStepView[];
  currentStep: OnboardingStepId | null;
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  goal: Goal | null;
}

export function buildView(
  completed: Map<OnboardingStepId, Date | null>,
  skipped: Set<OnboardingStepId> = new Set(),
  goal: Goal | null = null,
): OnboardingView {
  const isDone = (id: OnboardingStepId) => completed.has(id) || skipped.has(id);
  const currentIndex = STEPS.findIndex((s) => !isDone(s.id));
  const steps = STEPS.map((s, i) => ({
    ...s,
    order: i + 1,
    status: isDone(s.id)
      ? ("completed" as const)
      : i === currentIndex
        ? ("current" as const)
        : ("upcoming" as const),
    skipped: !completed.has(s.id) && skipped.has(s.id),
    completedAt: completed.get(s.id)?.toISOString() ?? null,
  }));
  return {
    steps,
    currentStep: currentIndex === -1 ? null : STEPS[currentIndex]!.id,
    completedCount: steps.filter((s) => s.status === "completed").length,
    totalCount: STEPS.length,
    isComplete: currentIndex === -1,
    goal,
  };
}
