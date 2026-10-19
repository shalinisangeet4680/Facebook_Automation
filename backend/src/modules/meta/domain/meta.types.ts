import {
  MetaAssetKind,
  MetaConnectionMethod,
} from "../infrastructure/meta.tables";

export type CheckStatus = "passed" | "warning" | "failed";

export interface ConnectionCheck {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
}

export interface AssetView {
  id: string;
  kind: MetaAssetKind;
  externalId: string;
  name: string;
  isPrimary: boolean;
  details: Record<string, unknown>;
}

export interface ConnectionView {
  status: "not_connected" | "active" | "invalid";
  method: MetaConnectionMethod | null;
  systemUser: { id: string; name: string } | null;
  tokenLast4: string | null;
  connectedAt: string | null;
  checkedAt: string | null;
  permissions: {
    granted: string[];
    missingRequired: string[];
    missingRecommended: string[];
    missingOptional: string[];
  };
  checks: ConnectionCheck[];
  assets: AssetView[];
}

export interface DiscoveredAsset {
  kind: MetaAssetKind;
  externalId: string;
  name: string;
  data: Record<string, unknown>;
}

export const META_EVENTS = {
  CONNECTED: "meta.connected",
  DISCONNECTED: "meta.disconnected",
  ASSETS_SELECTED: "meta.assets_selected",
} as const;

export interface MetaConnectedEvent {
  workspaceId: string;
  userId: string;
}
