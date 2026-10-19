import type { AdLevel, CampaignBudget, ReportPreset } from "@/lib/api/types";

export const A = "#0F6B4A";
export const MUTED = "#6C6962";
export const LINE = "1px solid #EFEDE8";

export const PRESETS: { id: ReportPreset; label: string }[] = [
  { id: "last_7d", label: "7 days" },
  { id: "last_14d", label: "14 days" },
  { id: "last_30d", label: "30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

export const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_TRAFFIC: "Website visits",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "App installs",
};

export const RESULT_LABELS: Record<string, string> = {
  lead: "Leads",
  "offsite_conversion.fb_pixel_lead": "Leads",
  complete_registration: "Sign-ups",
  "onsite_conversion.lead_grouped": "Leads",
  purchase: "Purchases",
  "offsite_conversion.fb_pixel_purchase": "Purchases",
  omni_purchase: "Purchases",
  landing_page_view: "Page views",
  link_click: "Clicks",
  post_engagement: "Engagements",
  mobile_app_install: "Installs",
};

const DELIVERY: Record<string, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: "Active", bg: "#EAF3EE", fg: A },
  PAUSED: { label: "Paused", bg: "#F4F2EE", fg: MUTED },
  CAMPAIGN_PAUSED: { label: "Campaign paused", bg: "#F4F2EE", fg: MUTED },
  ADSET_PAUSED: { label: "Ad set paused", bg: "#F4F2EE", fg: MUTED },
  IN_PROCESS: { label: "Processing", bg: "#EEF2FB", fg: "#2B4C9A" },
  PENDING_REVIEW: { label: "In review", bg: "#EEF2FB", fg: "#2B4C9A" },
  PREAPPROVED: { label: "Approved", bg: "#EEF2FB", fg: "#2B4C9A" },
  WITH_ISSUES: { label: "Has issues", bg: "#FDF0EE", fg: "#B42318" },
  DISAPPROVED: { label: "Rejected", bg: "#FDF0EE", fg: "#B42318" },
  PENDING_BILLING_INFO: { label: "Billing needed", bg: "#FBF3E2", fg: "#8A5A00" },
  ARCHIVED: { label: "Archived", bg: "#F4F2EE", fg: MUTED },
  DELETED: { label: "Deleted", bg: "#F4F2EE", fg: MUTED },
};

export function delivery(status: string) {
  return (
    DELIVERY[status] ?? {
      label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "),
      bg: "#F4F2EE",
      fg: MUTED,
    }
  );
}

export const LEVEL_LABELS: Record<AdLevel, string> = {
  campaign: "campaign",
  adset: "ad set",
  ad: "ad",
};

const formatters = new Map<string, Intl.NumberFormat>();

export function money(amount: number, currency: string, digits = 0): string {
  const key = `${currency}:${digits}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      });
    } catch {
      return `${amount.toFixed(digits)} ${currency}`;
    }
    formatters.set(key, f);
  }
  return f.format(amount);
}

export const count = new Intl.NumberFormat("en-IN");

export function budgetText(budget: CampaignBudget, currency: string): string {
  if (budget.amount === null) return "—";
  const amount = money(budget.amount, currency, 2);
  return budget.type === "lifetime" ? `${amount} total` : `${amount}/day`;
}

export function budgetSource(budget: CampaignBudget): string {
  if (budget.level === "campaign") return "Campaign budget";
  if (budget.level === "adset") return "Set on ad sets";
  return "No budget";
}

export function linkHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
