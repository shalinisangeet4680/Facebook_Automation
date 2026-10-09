export const META_ADS = Symbol("META_ADS");

export type InsightLevel = "account" | "campaign" | "adset" | "ad";
export type AdObjectType = "campaign" | "adset" | "ad";
export type AdStatus = "ACTIVE" | "PAUSED";

export interface InsightQuery {
  level: InsightLevel;
  datePreset?: string;
  since?: string;
  until?: string;
  daily: boolean;
  campaignId?: string;
  limit: number;
}

export interface InsightRow {
  id: string;
  name: string;
  objective: string | null;
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  linkClicks: number;
  ctr: number;
  cpc: number | null;
  cpm: number;
  actions: Record<string, number>;
}

export interface CampaignSummary {
  id: string;
  name: string;
  objective: string;
  status: string;
  effectiveStatus: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  startTime: string | null;
  stopTime: string | null;
  createdTime: string;
}

export interface AdSetSummary {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  optimizationGoal: string;
  billingEvent: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  targeting: Record<string, unknown>;
  promotedObject: Record<string, unknown> | null;
}

export interface AdSummary {
  id: string;
  name: string;
  adSetId: string;
  status: string;
  effectiveStatus: string;
  creative: {
    id: string;
    title: string | null;
    body: string | null;
    linkUrl: string | null;
    imageUrl: string | null;
    callToAction: string | null;
  } | null;
}

export interface CampaignDetail {
  campaign: CampaignSummary;
  adSets: AdSetSummary[];
  ads: AdSummary[];
}

export interface AdObject {
  id: string;
  type: AdObjectType;
  name: string;
  status: string;
  effectiveStatus: string;
  accountId: string;
  campaignId: string | null;
  dailyBudget: number | null;
}

export interface PixelEventCount {
  event: string;
  count: number;
}

export type TargetingSearchType = "city" | "region" | "country" | "interest";

export interface TargetingOption {
  key: string;
  name: string;
  type: string;
  region: string | null;
  countryCode: string | null;
  audienceSize: number | null;
}

export interface CampaignDraftInput {
  adAccountId: string;
  name: string;
  objective: string;
  dailyBudget: number;
  adSet: {
    optimizationGoal: string;
    billingEvent: string;
    destinationType: string | null;
    promotedObject: Record<string, unknown> | null;
    targeting: Record<string, unknown>;
  };
  creative: {
    pageId: string;
    instagramId: string | null;
    message: string;
    headline: string;
    description: string | null;
    link: string;
    imageUrl: string | null;
    imageHash: string | null;
    callToAction: string;
  };
}

export interface CampaignDraftResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
}

export interface MetaAds {
  insights(
    token: string,
    adAccountId: string,
    query: InsightQuery,
  ): Promise<InsightRow[]>;
  campaigns(token: string, adAccountId: string): Promise<CampaignSummary[]>;
  campaign(token: string, campaignId: string): Promise<CampaignDetail>;
  object(token: string, id: string): Promise<AdObject>;
  pixelEvents(
    token: string,
    pixelId: string,
    sinceUnix: number,
  ): Promise<PixelEventCount[]>;
  searchTargeting(
    token: string,
    adAccountId: string,
    type: TargetingSearchType,
    query: string,
    countryCode: string | null,
  ): Promise<TargetingOption[]>;
  createDraft(
    token: string,
    input: CampaignDraftInput,
  ): Promise<CampaignDraftResult>;
  setStatus(token: string, id: string, status: AdStatus): Promise<void>;
  setDailyBudget(token: string, id: string, dailyBudget: number): Promise<void>;
}
