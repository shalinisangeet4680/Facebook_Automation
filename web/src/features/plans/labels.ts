import type { PlanStatus } from "@/lib/api/types";

export const GOAL_LABELS: Record<string, { title: string; description: string }> = {
  leads: {
    title: "Leads",
    description: "Sign-ups or enquiries on your website, tracked by the Pixel",
  },
  instant_leads: {
    title: "Instant form leads",
    description:
      "People fill a short form inside Facebook or Instagram. No website or Pixel needed",
  },
  sales: { title: "Sales", description: "Purchases on your website, tracked by the Pixel" },
  traffic: { title: "Website visits", description: "People who open your website" },
  awareness: { title: "Awareness", description: "Reach as many people as possible" },
};

export const EVENT_LABELS: Record<string, string> = {
  LEAD: "Lead",
  COMPLETE_REGISTRATION: "Complete registration",
  CONTACT: "Contact",
  SCHEDULE: "Schedule",
  START_TRIAL: "Start trial",
  SUBSCRIBE: "Subscribe",
  PURCHASE: "Purchase",
};

export const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up",
  BOOK_NOW: "Book now",
  CONTACT_US: "Contact us",
  GET_QUOTE: "Get quote",
  APPLY_NOW: "Apply now",
  SHOP_NOW: "Shop now",
  SUBSCRIBE: "Subscribe",
  DOWNLOAD: "Download",
  GET_OFFER: "Get offer",
  WHATSAPP_MESSAGE: "Send WhatsApp message",
};

export const QUESTION_LABELS: Record<string, string> = {
  FULL_NAME: "Full name",
  PHONE: "Phone number",
  EMAIL: "Email",
  CITY: "City",
};

export const PREFILL_QUESTIONS = ["FULL_NAME", "PHONE", "EMAIL", "CITY"] as const;

export function privacyFrom(website: string | null | undefined): string {
  if (!website) return "";
  try {
    const url = new URL(website);
    return url.protocol === "https:" ? `${url.origin}/privacy` : "";
  } catch {
    return "";
  }
}

export const STATUS_LABELS: Record<PlanStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Ready for review", bg: "#EEF2FB", fg: "#2B4C9A" },
  created: { label: "Created in Meta · paused", bg: "#FBF3E2", fg: "#8A5A00" },
  launched: { label: "Live", bg: "#EAF3EE", fg: "#0F6B4A" },
  discarded: { label: "Discarded", bg: "#F4F2EE", fg: "#6C6962" },
};

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function sourceLabel(source: string): string {
  if (source.startsWith("mcp:")) return `Proposed by ${source.slice(4)}`;
  return "Created in TreeVook";
}
