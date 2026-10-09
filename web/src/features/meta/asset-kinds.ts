import type { AssetKind } from "@/lib/api/types";

export const ASSET_LABELS: Record<AssetKind, { one: string; many: string }> = {
  business: { one: "Business", many: "Businesses" },
  ad_account: { one: "Ad account", many: "Ad accounts" },
  page: { one: "Facebook Page", many: "Facebook Pages" },
  instagram: { one: "Instagram account", many: "Instagram accounts" },
  dataset: { one: "Dataset", many: "Datasets" },
};
