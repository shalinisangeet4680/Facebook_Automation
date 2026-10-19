export class GuideStepDto {
  id: string;
  title: string;
  description: string;
  actionLabel: string | null;
  actionUrl: string | null;
}

export class PermissionDto {
  name: string;
  level: "required" | "recommended" | "optional";
  purpose: string;
}

export class RequirementsResponseDto {
  steps: GuideStepDto[];
  permissions: PermissionDto[];
}

export class ConnectionCheckDto {
  key: string;
  label: string;
  status: "passed" | "warning" | "failed";
  message: string;
}

export class SystemUserDto {
  id: string;
  name: string;
}

export class PermissionSummaryDto {
  granted: string[];
  missingRequired: string[];
  missingRecommended: string[];
  missingOptional: string[];
}

export class AssetDto {
  id: string;
  kind: "business" | "ad_account" | "page" | "instagram" | "dataset";
  externalId: string;
  name: string;
  isPrimary: boolean;
  details: Record<string, unknown>;
}

export class AssetListResponseDto {
  data: AssetDto[];
}

export class ConnectionResponseDto {
  status: "not_connected" | "active" | "invalid";
  method: "system_user_token" | "facebook_login" | null;
  systemUser: SystemUserDto | null;
  tokenLast4: string | null;
  connectedAt: string | null;
  checkedAt: string | null;
  permissions: PermissionSummaryDto;
  checks: ConnectionCheckDto[];
  assets: AssetDto[];
}

export class MetaOAuthStatusDto {
  facebookLogin: boolean;
  redirectUri: string;
}

export class MetaOAuthUrlDto {
  url: string;
}

export class SwitchedAdAccountDto {
  id: string;
  name: string;
  currency: string;
}

export class AdAccountSwitchDto {
  adAccount: SwitchedAdAccountDto;
  changed: boolean;
  dataset: "kept" | "switched" | "cleared";
  needsReview: boolean;
  connection: ConnectionResponseDto;
}
