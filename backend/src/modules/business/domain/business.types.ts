import { REPLY_LIMITS } from "@modules/engine/domain/engine.types";

export const BUSINESS_REPLY_MAX = REPLY_LIMITS.google_business.max;
export const POST_SUMMARY_MAX = 1500;

export const POST_TYPES = ["STANDARD", "EVENT", "OFFER"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "failed",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const CTA_TYPES = [
  "BOOK",
  "ORDER",
  "SHOP",
  "LEARN_MORE",
  "SIGN_UP",
  "CALL",
] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const METRICS = [
  "impressionsMaps",
  "impressionsSearch",
  "calls",
  "websiteClicks",
  "directions",
  "conversations",
  "bookings",
] as const;
export type MetricKey = (typeof METRICS)[number];
export type DailyMetrics = Record<MetricKey, number>;

export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface OpeningPeriod {
  day: Weekday;
  open: string;
  close: string;
}

export interface BusinessAddress {
  lines: string[];
  locality: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface BusinessInfo {
  title: string;
  description: string;
  phone: string | null;
  website: string | null;
  address: BusinessAddress | null;
  primaryCategory: string | null;
  additionalCategories: string[];
  hours: OpeningPeriod[];
}

export const INFO_FIELDS = [
  "title",
  "description",
  "phone",
  "website",
  "hours",
] as const;
export type InfoField = (typeof INFO_FIELDS)[number];
export type InfoPatch = Partial<Pick<BusinessInfo, InfoField>>;

export const DESCRIPTION_MAX = 750;

export interface PostEvent {
  title: string;
  start: string;
  end: string;
}

export interface PostOffer {
  couponCode: string | null;
  redeemUrl: string | null;
  terms: string | null;
}

export interface PostContent {
  type: PostType;
  summary: string;
  mediaUrl: string | null;
  cta: { type: CtaType; url: string | null } | null;
  event: PostEvent | null;
  offer: PostOffer | null;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isUrl = (u: string) => /^https:\/\/[^\s]+\.[^\s]+$/.test(u);

export function checkPost(post: PostContent): string[] {
  const problems: string[] = [];
  if (!post.summary.trim()) problems.push("Write the post text.");
  if (post.summary.length > POST_SUMMARY_MAX)
    problems.push(`Posts can be at most ${POST_SUMMARY_MAX} characters.`);
  if (post.mediaUrl && !isUrl(post.mediaUrl))
    problems.push("The photo must be an https link.");
  if (post.cta) {
    if (post.cta.type === "CALL") {
      if (post.cta.url)
        problems.push(
          "A Call button uses the profile's phone number, so leave the link empty.",
        );
    } else if (!post.cta.url || !isUrl(post.cta.url))
      problems.push("The button needs an https link.");
  }
  if (post.type === "EVENT" || post.type === "OFFER") {
    if (!post.event?.title.trim())
      problems.push(
        post.type === "OFFER"
          ? "Give the offer a title."
          : "Give the event a title.",
      );
    const start = Date.parse(post.event?.start ?? "");
    const end = Date.parse(post.event?.end ?? "");
    if (Number.isNaN(start) || Number.isNaN(end))
      problems.push("Choose a start and end date.");
    else if (end < start) problems.push("The end must be after the start.");
  }
  if (post.type !== "OFFER" && post.offer)
    problems.push("Only offer posts can have a coupon or terms.");
  if (post.offer?.redeemUrl && !isUrl(post.offer.redeemUrl))
    problems.push("The redeem link must be an https link.");
  return problems;
}

export function checkInfo(patch: InfoPatch): string[] {
  const problems: string[] = [];
  if (patch.title !== undefined && !patch.title.trim())
    problems.push("The business name can't be empty.");
  if (patch.title && patch.title.length > 100)
    problems.push("The business name can be at most 100 characters.");
  if (patch.description && patch.description.length > DESCRIPTION_MAX)
    problems.push(
      `The description can be at most ${DESCRIPTION_MAX} characters.`,
    );
  if (patch.description && /https?:\/\/|www\./i.test(patch.description))
    problems.push("Google doesn't allow links in the description.");
  if (patch.website && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(patch.website))
    problems.push("The website must be a full link like https://example.com.");
  if (patch.phone && patch.phone.replace(/\D/g, "").length < 7)
    problems.push("The phone number looks too short.");
  for (const p of patch.hours ?? []) {
    if (!WEEKDAYS.includes(p.day)) problems.push(`${p.day} isn't a weekday.`);
    if (!HHMM.test(p.open) || !(HHMM.test(p.close) || p.close === "24:00"))
      problems.push(`Use 24-hour times like 09:00 for ${p.day.toLowerCase()}.`);
    else if (p.close !== "24:00" && p.close <= p.open)
      problems.push(
        `${p.day[0]}${p.day.slice(1).toLowerCase()} closes before it opens; split overnight hours into two days.`,
      );
  }
  return problems;
}

export function infoChanges(before: BusinessInfo, patch: InfoPatch): string[] {
  const out: string[] = [];
  const label: Record<InfoField, string> = {
    title: "Name",
    description: "Description",
    phone: "Phone",
    website: "Website",
    hours: "Opening hours",
  };
  for (const key of INFO_FIELDS) {
    if (patch[key] === undefined) continue;
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(patch[key] ?? null);
    if (a === b) continue;
    out.push(
      key === "hours"
        ? `${label[key]}: ${hoursText(patch.hours ?? [])}`
        : `${label[key]}: ${String(before[key] || "(none)")} → ${String(patch[key] || "(none)")}`,
    );
  }
  return out;
}

export function hoursText(hours: OpeningPeriod[]): string {
  if (!hours.length) return "closed every day";
  return WEEKDAYS.map((d) => {
    const ps = hours.filter((h) => h.day === d);
    const name = `${d[0]}${d.slice(1, 3).toLowerCase()}`;
    return ps.length
      ? `${name} ${ps.map((p) => `${p.open}–${p.close}`).join(", ")}`
      : `${name} closed`;
  }).join(" · ");
}

export function emptyMetrics(): DailyMetrics {
  return {
    impressionsMaps: 0,
    impressionsSearch: 0,
    calls: 0,
    websiteClicks: 0,
    directions: 0,
    conversations: 0,
    bookings: 0,
  };
}
