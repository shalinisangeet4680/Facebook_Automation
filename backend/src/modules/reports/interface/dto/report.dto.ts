import { IsIn, IsOptional } from "class-validator";

import { REPORT_PRESETS, ReportPreset } from "../../domain/periods";

export class ReportQueryDto {
  @IsOptional()
  @IsIn(REPORT_PRESETS)
  preset?: ReportPreset;
}

export class ReportPeriodDto {
  since: string;
  until: string;
}

export class ReportKpisDto {
  spend: number;
  results: number;
  costPerResult: number | null;
  impressions: number;
  reach: number;
  linkClicks: number;
  ctr: number | null;
  cpm: number | null;
}

export class ReportDayDto {
  date: string;
  spend: number;
  results: number;
  linkClicks: number;
}

export class ReportCampaignDto {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  spend: number;
  results: number;
  resultType: string | null;
  costPerResult: number | null;
  impressions: number;
  ctr: number | null;
}

export class ReportAdDto {
  id: string;
  name: string;
  spend: number;
  results: number;
  costPerResult: number | null;
  ctr: number;
}

export class ReportOverviewDto {
  currency: string;
  preset: "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month";
  period: ReportPeriodDto;
  previousPeriod: ReportPeriodDto;
  kpis: ReportKpisDto;
  previousKpis: ReportKpisDto;
  daily: ReportDayDto[];
  campaigns: ReportCampaignDto[];
  topAds: ReportAdDto[];
  targetCostPerResult: number | null;
}
