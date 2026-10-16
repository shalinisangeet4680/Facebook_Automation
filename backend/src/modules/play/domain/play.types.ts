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

export const REPLY_SOURCES = ["template", "claude", "manual"] as const;
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

export interface AppSettings {
  timezone: string;
  quietHours: QuietHours | null;
  dailyAutoLimit: number;
  neverAutoWords: string[];
  translateTo: string;
  replyToEdited: boolean;
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
};

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
