export type PermissionLevel = "required" | "recommended" | "optional";

export interface PermissionRequirement {
  name: string;
  level: PermissionLevel;
  purpose: string;
}

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  actionLabel: string | null;
  actionUrl: string | null;
}

export const PERMISSIONS: PermissionRequirement[] = [
  {
    name: "ads_management",
    level: "required",
    purpose: "Create and manage campaigns, ad sets, ads and audiences",
  },
  {
    name: "ads_read",
    level: "required",
    purpose: "Read results and reporting for your ads",
  },
  {
    name: "business_management",
    level: "required",
    purpose: "Read your business, its ad accounts and datasets",
  },
  {
    name: "pages_show_list",
    level: "required",
    purpose: "Find the Facebook Page your ads run from",
  },
  {
    name: "pages_read_engagement",
    level: "required",
    purpose: "Read Page details and engagement",
  },
  {
    name: "pages_manage_posts",
    level: "recommended",
    purpose: "Publish posts and Reels to your Page",
  },
  {
    name: "pages_manage_engagement",
    level: "recommended",
    purpose: "Reply to comments on posts and ads",
  },
  {
    name: "instagram_basic",
    level: "recommended",
    purpose: "Read your linked Instagram account",
  },
  {
    name: "instagram_content_publish",
    level: "recommended",
    purpose: "Publish posts and Reels to Instagram",
  },
  {
    name: "instagram_manage_comments",
    level: "optional",
    purpose: "Reply to Instagram comments",
  },
  {
    name: "leads_retrieval",
    level: "optional",
    purpose: "Receive leads from your instant forms in TreeVook",
  },
  {
    name: "pages_manage_ads",
    level: "optional",
    purpose: "Create instant forms (lead forms) on your Page",
  },
];

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "open_business_settings",
    title: "Open Meta Business settings",
    description:
      "Sign in to Meta Business Suite with the account that owns your ad account, then open Business settings.",
    actionLabel: "Open Business settings",
    actionUrl: "https://business.facebook.com/settings",
  },
  {
    id: "create_app",
    title: "Create a Meta app",
    description:
      "In Meta for Developers, create an app of type Business and connect it to your business portfolio.",
    actionLabel: "Open Meta for Developers",
    actionUrl: "https://developers.facebook.com/apps/creation/",
  },
  {
    id: "add_system_user",
    title: "Add a system user",
    description:
      "In Business settings go to Users → System users, add a system user with the Admin role.",
    actionLabel: "Open System users",
    actionUrl: "https://business.facebook.com/settings/system-users",
  },
  {
    id: "assign_assets",
    title: "Assign your assets",
    description:
      "Assign your ad account, Facebook Page, Instagram account and dataset (Pixel) to the system user with full control.",
    actionLabel: null,
    actionUrl: null,
  },
  {
    id: "generate_token",
    title: "Generate the token",
    description:
      "Click Generate token, choose your app, set expiry to Never and tick every permission listed here.",
    actionLabel: null,
    actionUrl: null,
  },
  {
    id: "paste_token",
    title: "Paste it here",
    description:
      "Copy the token and paste it below. It is encrypted immediately and never shown again.",
    actionLabel: null,
    actionUrl: null,
  },
];

export function missingPermissions(granted: string[]) {
  const set = new Set(granted);
  const missing = PERMISSIONS.filter((p) => !set.has(p.name));
  return {
    required: missing.filter((p) => p.level === "required").map((p) => p.name),
    recommended: missing
      .filter((p) => p.level === "recommended")
      .map((p) => p.name),
    optional: missing.filter((p) => p.level === "optional").map((p) => p.name),
  };
}
