export const REPLY_MAX = 350;

export const TEMPLATE_CATEGORIES = [
  "positive",
  "negative",
  "bug",
  "feature",
  "billing",
  "updated",
  "neutral",
  "custom",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const REPLY_STATUSES = [
  "pending_approval",
  "needs_claude",
  "scheduled",
  "sent",
  "failed",
  "discarded",
] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];
export const ACTIVE_REPLY_STATUSES: ReplyStatus[] = [
  "pending_approval",
  "needs_claude",
  "scheduled",
];

export const REPLY_SOURCES = ["template", "claude", "manual", "ai"] as const;

export const SYNC_ERROR_KINDS = [
  "no_permission",
  "api_disabled",
  "disconnected",
  "quota",
  "error",
] as const;
export type PlayErrorKindView = (typeof SYNC_ERROR_KINDS)[number];

export const AI_MODES = ["platform", "own", "off"] as const;
export type AiMode = (typeof AI_MODES)[number];
export type ReplySource = (typeof REPLY_SOURCES)[number];

export const RULE_MODES = ["approval", "auto"] as const;
export type RuleMode = (typeof RULE_MODES)[number];

export interface TemplateBody {
  language: string;
  variants: string[];
}

export interface RuleConditions {
  stars?: number[];
  keywordsAny?: string[];
  keywordsNone?: string[];
  languages?: string[];
  appVersions?: string[];
  edited?: boolean;
}

export type RuleAction =
  | { type: "template"; templateId: string }
  | { type: "claude" }
  | { type: "skip" };

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleConditions;
  action: RuleAction;
  mode: RuleMode;
  delayMinutes: number;
}

export interface QuietHours {
  start: string;
  end: string;
}

export const RATING_MODES = ["auto", "approval", "manual"] as const;
export type RatingMode = (typeof RATING_MODES)[number];

export interface RatingRule {
  rating: number;
  mode: RatingMode;
  templateId: string | null;
}

export const DELAYS = { instant: 0, "15m": 15, "1h": 60, "6h": 360 } as const;
export type DelayKey = keyof typeof DELAYS;

export const TONES = ["friendly", "professional", "concise"] as const;
export type Tone = (typeof TONES)[number];

export const TOPICS = [
  "Crash",
  "Sync",
  "Login",
  "Payment",
  "Performance",
  "Ads",
  "Feature request",
  "Support",
  "Praise",
  "Other",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface AppSettings {
  timezone: string;
  quietHours: QuietHours | null;
  dailyAutoLimit: number;
  neverAutoWords: string[];
  translateTo: string;
  replyToEdited: boolean;
  ratingRules: RatingRule[];
  delay: DelayKey;
  tone: Tone;
  translate: boolean;
  personalize: boolean;
  skipEmpty: boolean;
  escalate: boolean;
  autoPause: boolean;
}

export const DEFAULT_NEVER_AUTO_WORDS = [
  "lawyer",
  "legal",
  "sue",
  "court",
  "police",
  "fraud",
  "scam",
  "stolen",
  "hack",
  "child",
  "suicide",
  "harass",
  "discriminat",
  "consumer forum",
];

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: "Asia/Kolkata",
  quietHours: { start: "22:00", end: "08:00" },
  dailyAutoLimit: 50,
  neverAutoWords: DEFAULT_NEVER_AUTO_WORDS,
  translateTo: "en",
  replyToEdited: true,
  ratingRules: [],
  delay: "15m",
  tone: "friendly",
  translate: true,
  personalize: true,
  skipEmpty: true,
  escalate: false,
  autoPause: true,
};

export function normalizeSettings(
  raw: Partial<AppSettings> | null | undefined,
): AppSettings {
  return { ...DEFAULT_SETTINGS, ...raw };
}

export interface ReviewFacts {
  reviewId: string;
  authorName: string;
  stars: number;
  text: string;
  originalText: string | null;
  language: string | null;
  appVersionName: string | null;
  editedAfterReply: boolean;
}
