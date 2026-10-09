import { IsBoolean, IsObject } from "class-validator";

export class KeyedOptionDto {
  key: string;
  name: string;
}

export class CityOptionDto extends KeyedOptionDto {
  radiusKm?: number | null;
}

export class InterestOptionDto {
  id: string;
  name: string;
}

export class PlanTargetingDto {
  countries: string[];
  regions: KeyedOptionDto[];
  cities: CityOptionDto[];
  ageMin: number;
  ageMax: number;
  genders: "all" | "male" | "female";
  interests: InterestOptionDto[];
  workPositions: InterestOptionDto[];
  industries: InterestOptionDto[];
  behaviors: InterestOptionDto[];
}

export class PlanPostDto {
  platform: "facebook" | "instagram";
  id: string;
  permalink?: string | null;
  imageUrl?: string | null;
  text?: string | null;
}

export class PlanCreativeDto {
  primaryText: string;
  alternatives: string[];
  headline: string;
  description?: string | null;
  linkUrl: string;
  imageUrl?: string | null;
  imageIdea?: string | null;
  callToAction: string;
  post?: PlanPostDto | null;
}

export class PlanReasonsDto {
  goal: string;
  audience: string;
  budget: string;
  creative: string;
}

export class CampaignPlanDto {
  name: string;
  summary: string;
  goal: string;
  conversionEvent?: string | null;
  dailyBudget: number;
  targeting: PlanTargetingDto;
  creative: PlanCreativeDto;
  reasons: PlanReasonsDto;
  expectedResults?: string | null;
}

export class PlanMetaDto {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  adsManagerUrl: string;
}

export class PlanResponseDto {
  id: string;
  status: "draft" | "created" | "launched" | "discarded";
  source: string;
  plan: CampaignPlanDto;
  meta: PlanMetaDto | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export class GoalOptionDto {
  name: string;
  needsPixel: boolean;
}

export class PlanOptionsDto {
  currency: string;
  maxDailyBudget: number;
  goals: GoalOptionDto[];
  conversionEvents: string[];
  callsToAction: string[];
}

export class PlanDetailResponseDto extends PlanResponseDto {
  options: PlanOptionsDto;
}

export class PlanSummaryDto {
  id: string;
  status: "draft" | "created" | "launched" | "discarded";
  source: string;
  name: string;
  goal: string;
  dailyBudget: number;
  createdAt: string;
}

export class PlanListResponseDto {
  data: PlanSummaryDto[];
}

export class ReplacePlanDto {
  @IsObject()
  plan: CampaignPlanDto;
}

export class LaunchPlanDto {
  @IsBoolean()
  confirm: boolean;
}
