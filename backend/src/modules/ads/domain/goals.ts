export const GOALS = {
  traffic: {
    objective: "OUTCOME_TRAFFIC",
    optimizationGoal: "LANDING_PAGE_VIEWS",
    destinationType: "WEBSITE",
    needsPixel: false,
    instantForm: false,
    resultAction: "landing_page_view",
  },
  leads: {
    objective: "OUTCOME_LEADS",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    needsPixel: true,
    instantForm: false,
    resultAction: "lead",
  },
  instant_leads: {
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    needsPixel: false,
    instantForm: true,
    resultAction: "lead",
  },
  sales: {
    objective: "OUTCOME_SALES",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    needsPixel: true,
    instantForm: false,
    resultAction: "purchase",
  },
  awareness: {
    objective: "OUTCOME_AWARENESS",
    optimizationGoal: "REACH",
    destinationType: null,
    needsPixel: false,
    instantForm: false,
    resultAction: null,
  },
} as const;

export type Goal = keyof typeof GOALS;
export const GOAL_NAMES = Object.keys(GOALS) as Goal[];

export const CONVERSION_EVENTS = [
  "LEAD",
  "COMPLETE_REGISTRATION",
  "CONTACT",
  "SCHEDULE",
  "START_TRIAL",
  "SUBSCRIBE",
  "PURCHASE",
] as const;
export type ConversionEvent = (typeof CONVERSION_EVENTS)[number];

export const CALLS_TO_ACTION = [
  "LEARN_MORE",
  "SIGN_UP",
  "BOOK_NOW",
  "CONTACT_US",
  "GET_QUOTE",
  "APPLY_NOW",
  "SHOP_NOW",
  "SUBSCRIBE",
  "DOWNLOAD",
  "GET_OFFER",
  "WHATSAPP_MESSAGE",
] as const;
export type CallToAction = (typeof CALLS_TO_ACTION)[number];

export const LEAD_FORM_CALLS_TO_ACTION = [
  "SIGN_UP",
  "APPLY_NOW",
  "GET_QUOTE",
  "CONTACT_US",
  "LEARN_MORE",
  "BOOK_NOW",
  "SUBSCRIBE",
  "DOWNLOAD",
  "GET_OFFER",
] as const satisfies readonly CallToAction[];

const EVENT_ACTIONS: Record<ConversionEvent, string> = {
  LEAD: "lead",
  COMPLETE_REGISTRATION: "complete_registration",
  CONTACT: "contact",
  SCHEDULE: "schedule",
  START_TRIAL: "start_trial",
  SUBSCRIBE: "subscribe",
  PURCHASE: "purchase",
};

const OBJECTIVE_ACTIONS: Record<string, string[]> = {
  OUTCOME_LEADS: [
    "lead",
    "offsite_conversion.fb_pixel_lead",
    "complete_registration",
    "onsite_conversion.lead_grouped",
  ],
  OUTCOME_SALES: [
    "purchase",
    "offsite_conversion.fb_pixel_purchase",
    "omni_purchase",
  ],
  OUTCOME_TRAFFIC: ["landing_page_view", "link_click"],
  OUTCOME_ENGAGEMENT: [
    "post_engagement",
    "onsite_conversion.messaging_conversation_started_7d",
  ],
  OUTCOME_APP_PROMOTION: ["mobile_app_install"],
};

export function resultActionFor(event: ConversionEvent): string {
  return EVENT_ACTIONS[event];
}

export function resultFor(
  objective: string | null,
  actions: Record<string, number>,
): { action: string; count: number } | null {
  for (const action of OBJECTIVE_ACTIONS[objective ?? ""] ?? []) {
    const count = actions[action];
    if (count) return { action, count };
  }
  return null;
}
