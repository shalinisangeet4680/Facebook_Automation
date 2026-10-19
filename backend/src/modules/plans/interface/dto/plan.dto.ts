import { IsBoolean, IsObject } from "class-validator";

import { PlanTargetingDto } from "@modules/ads/interface/dto/audiences.dto";

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
  videoUrl?: string | null;
  imageIdea?: string | null;
  callToAction: string;
  post?: PlanPostDto | null;
}

export class PlanVariantDto {
  enabled: boolean;
  primaryText: string;
  headline: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export class PlanReasonsDto {
  goal: string;
  audience: string;
  budget: string;
  creative: string;
}

export class LeadFormIntroDto {
  headline: string;
  description?: string | null;
}

export class LeadFormCustomQuestionDto {
  label: string;
  type: "short_answer" | "multiple_choice";
  options: string[];
}

export class LeadFormButtonDto {
  type: "website" | "call";
  text: string;
  url?: string;
  phone?: string;
}

export class LeadFormThankYouDto {
  title: string;
  body: string;
  button: LeadFormButtonDto;
}

export class LeadFormDto {
  name: string;
  locale: string;
  intro: LeadFormIntroDto;
  questions: ("FULL_NAME" | "EMAIL" | "PHONE" | "CITY")[];
  customQuestions: LeadFormCustomQuestionDto[];
  privacyPolicyUrl: string;
  thankYou: LeadFormThankYouDto;
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
  leadForm?: LeadFormDto | null;
  variants?: PlanVariantDto[];
}

export class PlanAdMetaDto {
  label: string;
  adId: string;
  creativeId: string;
}

export class PlanAdAccountDto {
  id: string;
  name: string;
  currency: string;
}

export class PlanMetaDto {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  adsManagerUrl: string;
  leadFormId?: string | null;
  adAccountId?: string | null;
  ads?: PlanAdMetaDto[];
}

export class PlanResponseDto {
  id: string;
  status: "draft" | "created" | "launched" | "discarded";
  source: string;
  plan: CampaignPlanDto;
  meta: PlanMetaDto | null;
  adAccount: PlanAdAccountDto | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export class GoalOptionDto {
  name: string;
  needsPixel: boolean;
  instantForm: boolean;
}

export class LocaleOptionDto {
  code: string;
  name: string;
}

export class PlanOptionsDto {
  currency: string;
  maxDailyBudget: number;
  goals: GoalOptionDto[];
  conversionEvents: string[];
  callsToAction: string[];
  leadFormCallsToAction: string[];
  leadFormLocales: LocaleOptionDto[];
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
