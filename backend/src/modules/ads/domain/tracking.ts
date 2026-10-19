import { Goal, GOAL_NAMES, GOALS } from "./goals";

export type TrackingStatus = "healthy" | "warning" | "missing";

export interface EventCount {
  event: string;
  count: number;
}

export interface TrackingInput {
  dataset: {
    id: string;
    name: string;
    lastFiredTime: string | null;
  } | null;
  businessId: string | null;
  last24Hours: EventCount[];
  last7Days: EventCount[];
  now: Date;
}

export interface GoalFit {
  goal: Goal;
  ready: boolean;
  needs: string[];
  message: string;
  fix: string | null;
}

export interface TrackingReport {
  selected: boolean;
  pixel: { id: string; name: string; lastFiredTime: string | null } | null;
  status: TrackingStatus;
  reasons: string[];
  fixes: string[];
  warnings: string[];
  last24Hours: EventCount[];
  last7Days: EventCount[];
  events: { event: string; last24Hours: number; last7Days: number }[];
  totals: { last24Hours: number; last7Days: number };
  goals: GoalFit[];
  eventsManagerUrl: string;
  checkedAt: string;
}

export const STANDARD_EVENTS = [
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "AddToWishlist",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "Schedule",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "FindLocation",
  "CustomizeProduct",
  "Donate",
] as const;

export const CONVERSION_EVENT_NAMES = [
  "Lead",
  "Purchase",
  "CompleteRegistration",
  "Contact",
  "Schedule",
  "StartTrial",
  "Subscribe",
  "SubmitApplication",
];

export const GOAL_EVENTS: Record<Goal, string[]> = {
  traffic: [],
  leads: ["Lead", "CompleteRegistration", "Contact"],
  instant_leads: [],
  sales: ["Purchase"],
  awareness: [],
};

const CHOOSE_DATASET =
  "No dataset (Pixel) is selected. Choose one in Meta account → Choose accounts.";
const INSTALL_PIXEL =
  "Check the Meta Pixel code is on every page of your website. Open your site with the Meta Pixel Helper browser extension to see it fire.";

const total = (rows: EventCount[]) => rows.reduce((sum, r) => sum + r.count, 0);

const countOf = (rows: EventCount[], names: string[]) =>
  rows
    .filter((r) => names.includes(r.event))
    .reduce((sum, r) => sum + r.count, 0);

export function eventsManagerUrl(
  pixelId: string | null,
  businessId: string | null,
): string {
  const business = businessId ? `?business_id=${businessId}` : "";
  return pixelId
    ? `https://business.facebook.com/events_manager2/list/pixel/${pixelId}/overview${business}`
    : `https://business.facebook.com/events_manager2/list${business}`;
}

export function goalFit(
  goal: Goal,
  selected: boolean,
  last7Days: EventCount[],
): GoalFit {
  const needs = GOAL_EVENTS[goal];
  if (!needs.length) {
    return {
      goal,
      ready: true,
      needs,
      message: GOALS[goal].instantForm
        ? "Instant forms collect leads on Facebook and Instagram, so no Pixel is needed."
        : "This goal doesn't need Pixel tracking.",
      fix: null,
    };
  }
  const label = needs.join(", ");
  if (!selected) {
    return {
      goal,
      ready: false,
      needs,
      message: `This goal needs a Pixel that records ${label} events, and no dataset is selected.`,
      fix: CHOOSE_DATASET,
    };
  }
  if (countOf(last7Days, needs) > 0) {
    return {
      goal,
      ready: true,
      needs,
      message: `Your Pixel recorded ${needs.filter((n) => countOf(last7Days, [n]) > 0).join(", ")} events in the last 7 days.`,
      fix: null,
    };
  }
  return {
    goal,
    ready: false,
    needs,
    message:
      goal === "sales"
        ? "No Purchase events in the last 7 days."
        : "No Lead, CompleteRegistration or Contact events in the last 7 days.",
    fix:
      goal === "sales"
        ? "Check the Pixel's Purchase event fires on your order confirmation page, then place a test order."
        : "Check the Pixel's Lead event fires on your thank-you page (the page people see after sending the form), then send a test enquiry.",
  };
}

function merge(day: EventCount[], week: EventCount[]) {
  const names = [...new Set([...week, ...day].map((e) => e.event))];
  return names
    .map((event) => ({
      event,
      last24Hours: countOf(day, [event]),
      last7Days: countOf(week, [event]),
    }))
    .sort((a, b) => b.last7Days - a.last7Days || b.last24Hours - a.last24Hours);
}

function hoursAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (now.getTime() - t) / 3_600_000;
}

export function buildTrackingReport(input: TrackingInput): TrackingReport {
  const { dataset, now } = input;
  const selected = dataset !== null;
  const day = selected ? input.last24Hours : [];
  const week = selected ? input.last7Days : [];
  const reasons: string[] = [];
  const fixes: string[] = [];
  let status: TrackingStatus = "healthy";

  if (!dataset) {
    status = "missing";
    reasons.push("No dataset (Pixel) is selected for this workspace.");
    fixes.push(CHOOSE_DATASET);
  } else if (total(week) === 0) {
    status = "missing";
    const since = hoursAgo(dataset.lastFiredTime, now);
    reasons.push(
      since === null
        ? "Your Pixel has never sent an event."
        : `Your Pixel hasn't sent any events in the last 7 days (last event ${Math.round(since / 24)} days ago).`,
    );
    fixes.push(INSTALL_PIXEL);
  } else {
    if (total(day) === 0) {
      status = "warning";
      reasons.push(
        "The Pixel hasn't received any events in the last 24 hours.",
      );
      fixes.push(
        "Open your website yourself to check the Pixel still fires. If your site changed recently, the Pixel code may have been removed.",
      );
    }
    if (countOf(week, CONVERSION_EVENT_NAMES) === 0) {
      status = "warning";
      reasons.push(
        "No conversion events (Lead, Purchase, CompleteRegistration…) in the last 7 days.",
      );
      fixes.push(
        "Set up a Lead or Purchase event on the page people reach after they enquire or buy, usually your thank-you page. Events Manager's event setup tool can do this without code.",
      );
    }
  }

  return {
    selected,
    pixel: dataset
      ? {
          id: dataset.id,
          name: dataset.name,
          lastFiredTime: dataset.lastFiredTime,
        }
      : null,
    status,
    reasons,
    fixes,
    warnings: reasons,
    last24Hours: day,
    last7Days: week,
    events: merge(day, week),
    totals: { last24Hours: total(day), last7Days: total(week) },
    goals: GOAL_NAMES.map((goal) => goalFit(goal, selected, week)),
    eventsManagerUrl: eventsManagerUrl(dataset?.id ?? null, input.businessId),
    checkedAt: now.toISOString(),
  };
}
