import type { components } from "./schema";

type Schemas = components["schemas"];

export type Me = Schemas["MeResponseDto"];
export type Onboarding = Schemas["OnboardingResponseDto"];
export type OnboardingStep = Schemas["OnboardingStepDto"];
export type Requirements = Schemas["RequirementsResponseDto"];
export type GuideStep = Schemas["GuideStepDto"];
export type Permission = Schemas["PermissionDto"];
export type Connection = Schemas["ConnectionResponseDto"];
export type ConnectionCheck = Schemas["ConnectionCheckDto"];
export type Asset = Schemas["AssetDto"];
export type AssetKind = Asset["kind"];
export type Job = Schemas["JobResponseDto"];
export type OtpRequested = Schemas["OtpRequestedDto"];
export type SignIn = Schemas["SignInResponseDto"];
export type AssetSelection = Schemas["SelectAssetsDto"];
export type AuthorizationContext = Schemas["AuthorizationContextDto"];
export type AuthorizationQuery = Omit<
  Schemas["AuthorizationDecisionDto"],
  "approve" | "allowWrite"
>;
export type ConnectedApp = Schemas["ConnectedAppDto"];
export type CampaignPlan = Schemas["CampaignPlanDto"];
export type PlanDetail = Schemas["PlanDetailResponseDto"];
export type PlanSummary = Schemas["PlanSummaryDto"];
export type PlanStatus = PlanSummary["status"];
export type TargetingOption = Schemas["TargetingOptionDto"];
export type Settings = Schemas["SettingsResponseDto"];
export type WorkspaceUpdate = Schemas["UpdateWorkspaceDto"];
export type ProfileUpdate = Schemas["UpdateProfileDto"];
export type ReportOverview = Schemas["ReportOverviewDto"];
export type ReportPreset = ReportOverview["preset"];
