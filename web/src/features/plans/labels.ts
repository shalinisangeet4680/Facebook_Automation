import type { PlanStatus } from "@/lib/api/types";

export const GOAL_LABELS: Record<string, { title: string; description: string }> = {
  leads: {
    title: "Leads",
    description: "Sign-ups or enquiries on your website, tracked by the Pixel",
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

export const STATUS_LABELS: Record<
  PlanStatus,
  { label: string; tone: "accent" | "warning" | "success" | "neutral" }
> = {
  draft: { label: "Ready for review", tone: "accent" },
  created: { label: "Created in Meta · paused", tone: "warning" },
  launched: { label: "Live", tone: "success" },
  discarded: { label: "Discarded", tone: "neutral" },
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
  return "Created in Autopilot";
}
