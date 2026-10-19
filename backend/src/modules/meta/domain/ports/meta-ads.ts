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

export type AdCreativeKind = "link" | "video" | "post" | "other";

export interface AdCreativeSummary {
  id: string;
  kind: AdCreativeKind;
  title: string | null;
  body: string | null;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  imageHash: string | null;
  thumbnailUrl: string | null;
  callToAction: string | null;
  pageId: string | null;
  instagramId: string | null;
  postId: string | null;
  leadFormId?: string | null;
  videoId?: string | null;
}

export interface AdSummary {
  id: string;
  name: string;
  adSetId: string;
  status: string;
  effectiveStatus: string;
  creative: AdCreativeSummary | null;
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
  lifetimeBudget: number | null;
}

export interface PixelEventCount {
  event: string;
  count: number;
}

export interface PixelDetails {
  id: string;
  name: string;
  lastFiredTime: string | null;
}

export type TargetingSearchType =
  | "city"
  | "region"
  | "country"
  | "interest"
  | "work_position"
  | "industry"
  | "behavior";

export interface TargetingOption {
  key: string;
  name: string;
  type: string;
  region: string | null;
  countryCode: string | null;
  audienceSize: number | null;
}

export type LeadFormButtonInput =
  | { type: "website"; text: string; url: string }
  | { type: "call"; text: string; phone: string };

export interface LeadFormInput {
  pageId: string;
  name: string;
  locale: string;
  intro: { headline: string; description: string | null };
  questions: string[];
  customQuestions: { key: string; label: string; options: string[] }[];
  privacyPolicyUrl: string;
  thankYou: { title: string; body: string; button: LeadFormButtonInput };
}

export interface LeadFormQuestion {
  key: string;
  label: string;
  type: string;
}

export interface LeadFormSummary {
  id: string;
  name: string;
  status: string;
  locale: string | null;
  createdTime: string | null;
  questions: LeadFormQuestion[];
}

export interface LeadFieldValue {
  name: string;
  values: string[];
}

export interface LeadRecord {
  id: string;
  formId: string;
  createdTime: string;
  fieldData: LeadFieldValue[];
  adId: string | null;
  adName: string | null;
  adSetId: string | null;
  adSetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

export interface DraftAdInput {
  label: string;
  creative: CreativeInput;
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
  creative: CreativeInput;
  variants?: DraftAdInput[];
  leadForm?: LeadFormInput | null;
}

export interface CreativeInput {
  pageId: string;
  instagramId: string | null;
  message: string;
  headline: string;
  description: string | null;
  link: string;
  imageUrl: string | null;
  imageHash: string | null;
  callToAction: string;
  existingPost: { platform: "facebook" | "instagram"; id: string } | null;
  leadFormId?: string | null;
  videoId?: string | null;
}

export interface CreativeReplaceInput {
  adAccountId: string;
  adId: string;
  name: string;
  creative: CreativeInput;
}

export interface DraftAdResult {
  label: string;
  adId: string;
  creativeId: string;
}

export interface CampaignDraftResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  ads: DraftAdResult[];
  leadFormId?: string;
}

export interface UploadedVideo {
  videoId: string;
  thumbnailUrl: string | null;
}

export interface CustomAudienceSummary {
  id: string;
  name: string;
  subtype: string | null;
  approximateCount: number | null;
}

export interface MetaAds {
  insights(
    token: string,
    adAccountId: string,
    query: InsightQuery,
  ): Promise<InsightRow[]>;
  campaigns(token: string, adAccountId: string): Promise<CampaignSummary[]>;
  campaign(token: string, campaignId: string): Promise<CampaignDetail>;
  adSets(token: string, adAccountId: string): Promise<AdSetSummary[]>;
  ad(token: string, adId: string): Promise<AdSummary>;
  object(token: string, id: string): Promise<AdObject>;
  pixelEvents(
    token: string,
    pixelId: string,
    sinceUnix: number,
  ): Promise<PixelEventCount[]>;
  pixel(token: string, pixelId: string): Promise<PixelDetails>;
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
  replaceCreative(
    token: string,
    input: CreativeReplaceInput,
  ): Promise<{ creativeId: string }>;
  uploadVideo(
    token: string,
    adAccountId: string,
    fileUrl: string,
    name: string,
  ): Promise<UploadedVideo>;
  customAudiences(
    token: string,
    adAccountId: string,
  ): Promise<CustomAudienceSummary[]>;
  pageAccessToken(token: string, pageId: string): Promise<string>;
  leadForms(pageToken: string, pageId: string): Promise<LeadFormSummary[]>;
  leads(
    pageToken: string,
    formId: string,
    sinceUnix: number | null,
  ): Promise<LeadRecord[]>;
}
