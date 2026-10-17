export type OnboardingStepId =
  | "sign_in"
  | "connect_meta"
  | "choose_assets"
  | "business_profile"
  | "goal_budget"
  | "tracking_check"
  | "campaign_plan"
  | "creatives"
  | "launch";

export interface StepDefinition {
  id: OnboardingStepId;
  title: string;
  description: string;
  available: boolean;
}

export const STEPS: StepDefinition[] = [
  {
    id: "sign_in",
    title: "Create your account",
    description: "Sign in with Google.",
    available: true,
  },
  {
    id: "connect_meta",
    title: "Connect Meta",
    description: "Link your Meta Business with a system user token.",
    available: true,
  },
  {
    id: "choose_assets",
    title: "Choose your accounts",
    description:
      "Pick the ad account, Page, Instagram account and dataset to use.",
    available: true,
  },
  {
    id: "business_profile",
    title: "Business profile",
    description:
      "We read your website and summarise what you sell and to whom.",
    available: false,
  },
  {
    id: "goal_budget",
    title: "Goal and budget",
    description: "Set your goal, monthly budget and a hard spending cap.",
    available: false,
  },
  {
    id: "tracking_check",
    title: "Tracking check",
    description: "Make sure your Pixel and conversion events are working.",
    available: false,
  },
  {
    id: "campaign_plan",
    title: "Campaign plan",
    description: "Review the AI campaign plan and approve it.",
    available: false,
  },
  {
    id: "creatives",
    title: "Creatives",
    description: "Pick ad copy, images and videos.",
    available: false,
  },
  {
    id: "launch",
    title: "Review and launch",
    description: "Preview every ad and launch when you're ready.",
    available: false,
  },
];

export type StepStatus = "completed" | "current" | "upcoming";

export interface OnboardingStepView extends StepDefinition {
  order: number;
  status: StepStatus;
  completedAt: string | null;
}

export interface OnboardingView {
  steps: OnboardingStepView[];
  currentStep: OnboardingStepId | null;
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}

export function buildView(
  completed: Map<OnboardingStepId, Date | null>,
): OnboardingView {
  const currentIndex = STEPS.findIndex((s) => !completed.has(s.id));
  const steps = STEPS.map((s, i) => ({
    ...s,
    order: i + 1,
    status: completed.has(s.id)
      ? ("completed" as const)
      : i === currentIndex
        ? ("current" as const)
        : ("upcoming" as const),
    completedAt: completed.get(s.id)?.toISOString() ?? null,
  }));
  return {
    steps,
    currentStep: currentIndex === -1 ? null : STEPS[currentIndex]!.id,
    completedCount: steps.filter((s) => s.status === "completed").length,
    totalCount: STEPS.length,
    isComplete: currentIndex === -1,
  };
}
