import { Goal } from "@modules/ads/domain/goals";

export const PLAN_AI = Symbol("PLAN_AI");

export interface PlanAiPastCampaign {
  name: string;
  objective: string | null;
  spend: number;
  results: number;
  costPerResult: number | null;
}

export interface PlanAiInput {
  goal: Goal;
  offer: string;
  audienceNotes: string | null;
  landingUrl: string | null;
  language: string | null;
  dailyBudget: number;
  requestedDailyBudget: number;
  currency: string;
  maxDailyBudget: number;
  targetCostPerResult: number | null;
  locations: string[];
  ageMin: number | null;
  ageMax: number | null;
  hasVisual: boolean;
  business: {
    name: string | null;
    page: string | null;
    instagram: string | null;
    pixel: boolean;
    pixelEvents: string[];
    website: string | null;
    sells: string | null;
    area: string | null;
    category: string | null;
  };
  pastCampaigns: PlanAiPastCampaign[];
}

export interface PlanAiResult {
  name: string;
  summary: string;
  conversionEvent: string | null;
  ageMin: number | null;
  ageMax: number | null;
  genders: "all" | "male" | "female";
  interests: string[];
  primaryText: string;
  alternatives: string[];
  headline: string;
  description: string | null;
  callToAction: string;
  imageIdea: string | null;
  reasons: { goal: string; audience: string; budget: string; creative: string };
  expectedResults: string | null;
}

export interface PlanAi {
  write(apiKey: string, input: PlanAiInput): Promise<PlanAiResult>;
}
