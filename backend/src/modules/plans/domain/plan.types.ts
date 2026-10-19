import { CampaignPlanStatus } from "../infrastructure/plans.tables";
import { CampaignPlan } from "./plan.schema";

export interface PlanAdMeta {
  label: string;
  adId: string;
  creativeId: string;
}

export interface PlanMeta {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  adsManagerUrl: string;
  leadFormId?: string | null;
  adAccountId?: string | null;
  ads?: PlanAdMeta[];
}

export interface PlanAdAccount {
  id: string;
  name: string;
  currency: string;
}

export interface PlanView {
  id: string;
  status: CampaignPlanStatus;
  source: string;
  plan: CampaignPlan;
  meta: PlanMeta | null;
  adAccount: PlanAdAccount | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSummaryView {
  id: string;
  status: CampaignPlanStatus;
  source: string;
  name: string;
  goal: string;
  dailyBudget: number;
  createdAt: string;
}
