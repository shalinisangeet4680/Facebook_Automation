import { ConversionEvent, CallToAction, Goal } from "./goals";

export interface AdsActor {
  userId: string;
  workspaceId: string;
  via: string;
}

export interface PerformanceInput {
  level: "account" | "campaign" | "adset" | "ad";
  datePreset?: string;
  since?: string;
  until?: string;
  daily?: boolean;
  campaignId?: string;
  limit?: number;
}

export interface TargetingInput {
  countries?: string[];
  regionKeys?: string[];
  cities?: { key: string; radiusKm?: number }[];
  ageMin?: number;
  ageMax?: number;
  genders?: "all" | "male" | "female";
  interests?: { id: string; name?: string }[];
}

export interface DraftInput {
  name: string;
  goal: Goal;
  conversionEvent?: ConversionEvent;
  dailyBudget: number;
  targeting: TargetingInput;
  creative: {
    primaryText: string;
    headline: string;
    description?: string;
    linkUrl: string;
    imageUrl?: string;
    imageHash?: string;
    callToAction: CallToAction;
  };
}

export interface ConfirmationRequired {
  status: "confirmation_required";
  summary: string;
  confirmToken: string;
  expiresInSeconds: number;
}
