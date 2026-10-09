export class OnboardingStepDto {
  id: string;
  order: number;
  title: string;
  description: string;
  available: boolean;
  status: "completed" | "current" | "upcoming";
  completedAt: string | null;
}

export class OnboardingResponseDto {
  steps: OnboardingStepDto[];
  currentStep: string | null;
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}
