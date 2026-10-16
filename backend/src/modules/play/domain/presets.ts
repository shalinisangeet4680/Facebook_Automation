import {
  RuleConditions,
  RuleMode,
  TemplateBody,
  TemplateCategory,
} from "@modules/engine/domain/engine.types";

export interface PresetTemplate {
  key: string;
  name: string;
  category: TemplateCategory;
  ratings: number[];
  bodies: TemplateBody[];
}

const en = (text: string): TemplateBody[] => [
  { language: "en", variants: [text] },
];

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    key: "grateful",
    name: "Grateful thanks",
    category: "positive",
    ratings: [5],
    bodies: en(
      "Hi {user_name}, thank you for the {rating}-star review! We’re so glad {app_name} is part of your day. More is coming in {version}.",
    ),
  },
  {
    key: "nudge",
    name: "Thanks + nudge",
    category: "positive",
    ratings: [4],
    bodies: en(
      "Thanks {user_name}! Glad you’re enjoying {app_name}. If one thing would make it a 5, tell us at {support_email}.",
    ),
  },
  {
    key: "follow_up",
    name: "Neutral follow-up",
    category: "neutral",
    ratings: [3],
    bodies: en(
      "Hi {user_name}, thanks for the honest feedback. We’d love to hear what would make {app_name} better — reach us at {support_email}.",
    ),
  },
  {
    key: "apology",
    name: "Apology & support",
    category: "negative",
    ratings: [1, 2],
    bodies: en(
      "Hi {user_name}, we’re sorry {app_name} let you down. Please email {support_email} with details so we can fix this quickly. — {developer_name}",
    ),
  },
  {
    key: "fixed",
    name: "Fixed in update",
    category: "bug",
    ratings: [1, 2, 3],
    bodies: en(
      "Hi {user_name}, thanks for reporting this. It’s fixed in {version} — please update, and let us know at {support_email} if it persists.",
    ),
  },
  {
    key: "bug",
    name: "Bug or crash",
    category: "bug",
    ratings: [1, 2, 3],
    bodies: en(
      "Hi {user_name}, sorry for the trouble and thanks for reporting it. Please email {support_email} with your phone model so we can fix it fast. — {developer_name}",
    ),
  },
  {
    key: "billing",
    name: "Payment or refund",
    category: "billing",
    ratings: [1, 2, 3],
    bodies: en(
      "Hi {user_name}, sorry about the payment trouble. Please send your order ID to {support_email} and we’ll resolve it as a priority. — {developer_name}",
    ),
  },
  {
    key: "feature",
    name: "Feature request",
    category: "feature",
    ratings: [3, 4],
    bodies: en(
      "Thanks for the idea, {user_name}! We’ve shared it with the {app_name} team. Keep the suggestions coming. — {developer_name}",
    ),
  },
  {
    key: "updated",
    name: "Thanks for updating",
    category: "updated",
    ratings: [4, 5],
    bodies: en(
      "Thank you for updating your review, {user_name}! We’re really glad {app_name} is working well for you now. — {developer_name}",
    ),
  },
];

export const RATING_PRESETS: Record<number, string> = {
  5: "grateful",
  4: "nudge",
  3: "follow_up",
  2: "apology",
  1: "apology",
};

export interface PresetRule {
  name: string;
  conditions: RuleConditions;
  templateKey: string;
  mode: RuleMode;
  delayMinutes: number;
}

export const BUG_WORDS = [
  "crash",
  "bug",
  "error",
  "not working",
  "doesn't work",
  "does not work",
  "stuck",
  "freez",
  "not opening",
  "won't open",
  "keeps closing",
];

export const BILLING_WORDS = [
  "payment",
  "refund",
  "charged",
  "deducted",
  "subscription",
  "billing",
  "money",
];

export const PRESET_RULES: PresetRule[] = [
  {
    name: "Thank people who raised their rating",
    conditions: { edited: true, stars: [4, 5] },
    templateKey: "updated",
    mode: "approval",
    delayMinutes: 60,
  },
  {
    name: "Payment or refund problems",
    conditions: { keywordsAny: BILLING_WORDS },
    templateKey: "billing",
    mode: "approval",
    delayMinutes: 30,
  },
  {
    name: "Bugs and crashes",
    conditions: { keywordsAny: BUG_WORDS },
    templateKey: "bug",
    mode: "approval",
    delayMinutes: 30,
  },
];
