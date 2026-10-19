import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { REPORT_PRESETS, ReportPreset } from "@modules/reports/domain/periods";

import { CALLS_TO_ACTION, CallToAction } from "../../domain/goals";

export class CampaignListQueryDto {
  @IsOptional()
  @IsIn(REPORT_PRESETS)
  preset?: ReportPreset;

  @IsOptional()
  @IsIn(["all", "active", "paused"])
  status?: "all" | "active" | "paused";
}

export class CampaignDetailQueryDto {
  @IsOptional()
  @IsIn(REPORT_PRESETS)
  preset?: ReportPreset;
}

export class SetStatusDto {
  @IsIn(["ACTIVE", "PAUSED"])
  status: "ACTIVE" | "PAUSED";
}

export class SetBudgetDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  dailyBudget: number;
}

export class UpdateAdCreativeDto {
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  primaryText?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  headline?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  description?: string | null;

  @IsOptional()
  @IsIn(CALLS_TO_ACTION)
  callToAction?: CallToAction;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(2000)
  link?: string;

  @IsOptional()
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(2000)
  imageUrl?: string;
}

export class CampaignPeriodDto {
  since: string;
  until: string;
}

export class AdMetricsDto {
  spend: number;
  results: number;
  resultType: string | null;
  costPerResult: number | null;
  impressions: number;
  linkClicks: number;
  ctr: number | null;
}

export class CampaignBudgetDto {
  level: "campaign" | "adset" | null;
  type: "daily" | "lifetime" | null;
  amount: number | null;
}

export class CampaignRowDto {
  id: string;
  name: string;
  objective: string;
  status: string;
  effectiveStatus: string;
  budget: CampaignBudgetDto;
  budgetEditable: boolean;
  adSetCount: number;
  startTime: string | null;
  stopTime: string | null;
  createdTime: string;
  adsManagerUrl: string;
  metrics: AdMetricsDto;
}

export class CampaignListDto {
  currency: string;
  preset: "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month";
  period: CampaignPeriodDto;
  canManage: boolean;
  total: number;
  truncated: boolean;
  campaigns: CampaignRowDto[];
}

export class TargetingSummaryDto {
  locations: string | null;
  age: string | null;
  gender: string | null;
  audience: string | null;
}

export class AdSetRowDto {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  optimizationGoal: string;
  budget: CampaignBudgetDto;
  budgetEditable: boolean;
  targeting: TargetingSummaryDto;
  metrics: AdMetricsDto;
}

export class AdCreativeViewDto {
  id: string | null;
  kind: "link" | "post" | "other";
  editable: boolean;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  callToAction: string | null;
  link: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  leadFormId: string | null;
}

export class AdRowDto {
  id: string;
  name: string;
  adSetId: string;
  status: string;
  effectiveStatus: string;
  creative: AdCreativeViewDto;
  metrics: AdMetricsDto;
}

export class BudgetGuardrailsDto {
  maxDailyBudget: number;
  monthlyBudget: number | null;
}

export class CampaignDetailDto {
  currency: string;
  preset: "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month";
  period: CampaignPeriodDto;
  canManage: boolean;
  guardrails: BudgetGuardrailsDto;
  campaign: CampaignRowDto;
  adSets: AdSetRowDto[];
  ads: AdRowDto[];
}

export class StatusChangeDto {
  id: string;
  type: "campaign" | "adset" | "ad";
  name: string;
  status: "ACTIVE" | "PAUSED";
  effectiveStatus: string;
  changed: boolean;
}

export class BudgetChangeDto {
  id: string;
  type: "campaign" | "adset" | "ad";
  name: string;
  from: number | null;
  to: number;
  currency: string;
  warnings: string[];
  projectedMonthSpend: number | null;
}

export class CreativeChangeDto {
  id: string;
  name: string;
  creativeId: string;
  changed: string[];
}
