import {
  RuleConditions,
  RuleMode,
  TemplateBody,
  TemplateCategory,
} from "./play.types";

export interface PresetTemplate {
  key: string;
  name: string;
  category: TemplateCategory;
  bodies: TemplateBody[];
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    key: "thanks",
    name: "Thank you",
    category: "positive",
    bodies: [
      {
        language: "en",
        variants: [
          "Thank you {{first_name|so much}}! We're glad {{app_name}} helps you. If there's anything we can do better, tell us anytime. – {{team_name|The team}}",
          "Thanks for the lovely review, {{first_name|friend}}! Reviews like yours keep us going. – {{team_name|The team}}",
          "Hi {{first_name|there}}, thank you for taking the time to rate {{app_name}}. We're happy you're enjoying it! – {{team_name|The team}}",
        ],
      },
      {
        language: "hi",
        variants: [
          "धन्यवाद {{first_name|आपका}}! हमें खुशी है कि {{app_name}} आपके काम आ रहा है। – {{team_name|टीम}}",
          "{{first_name|आपके}} इतने अच्छे रिव्यू के लिए शुक्रिया! आपका साथ हमें और बेहतर बनाने में मदद करता है। – {{team_name|टीम}}",
        ],
      },
    ],
  },
  {
    key: "negative",
    name: "Sorry, let us help",
    category: "negative",
    bodies: [
      {
        language: "en",
        variants: [
          "Sorry {{first_name|to hear this}}, that's not the experience we want for you. Please reach us at {{support_email|our in-app Help section}} and we'll sort it out quickly. – {{team_name|The team}}",
          "Hi {{first_name|there}}, we're sorry {{app_name}} let you down. Write to {{support_email|our support team from the app's Help section}} with a few details and we'll help right away. – {{team_name|The team}}",
        ],
      },
      {
        language: "hi",
        variants: [
          "माफ़ कीजिए {{first_name|}}, आपको परेशानी हुई। कृपया {{support_email|ऐप के Help सेक्शन}} पर हमें लिखें, हम जल्दी ठीक करेंगे। – {{team_name|टीम}}",
        ],
      },
    ],
  },
  {
    key: "bug",
    name: "Bug or crash",
    category: "bug",
    bodies: [
      {
        language: "en",
        variants: [
          "Sorry for the trouble, {{first_name|and thanks for reporting it}}. Please update {{app_name}} to the latest version and if it still happens, email {{support_email|us from the app's Help section}} with your phone model so we can fix it fast. – {{team_name|The team}}",
          "Hi {{first_name|there}}, thanks for flagging this. Our team is looking into it. Could you write to {{support_email|us from the Help section}} with what you were doing when it happened? – {{team_name|The team}}",
        ],
      },
    ],
  },
  {
    key: "billing",
    name: "Payment or refund",
    category: "billing",
    bodies: [
      {
        language: "en",
        variants: [
          "Hi {{first_name|there}}, sorry about the payment trouble. Please contact {{support_email|our support team}} with your order details and we'll resolve it as a priority. – {{team_name|The team}}",
          "We're sorry {{first_name|}} – payment issues are frustrating. Send your order ID to {{support_email|our support team}} and we'll check it today. – {{team_name|The team}}",
        ],
      },
    ],
  },
  {
    key: "feature",
    name: "Feature request",
    category: "feature",
    bodies: [
      {
        language: "en",
        variants: [
          "Thanks for the idea, {{first_name|friend}}! We've shared it with our product team. Keep the suggestions coming. – {{team_name|The team}}",
          "Great suggestion, {{first_name|thank you}}! We're noting it for a future update of {{app_name}}. – {{team_name|The team}}",
        ],
      },
    ],
  },
  {
    key: "neutral",
    name: "Mixed review",
    category: "neutral",
    bodies: [
      {
        language: "en",
        variants: [
          "Thanks for your feedback, {{first_name|friend}}. We'd love to know what would make {{app_name}} five stars for you – write to {{support_email|us from the Help section}}. – {{team_name|The team}}",
        ],
      },
    ],
  },
  {
    key: "updated",
    name: "Thanks for updating your review",
    category: "updated",
    bodies: [
      {
        language: "en",
        variants: [
          "Thank you for updating your review, {{first_name|friend}}! We're really glad it's working well for you now. – {{team_name|The team}}",
        ],
      },
    ],
  },
];

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
  {
    name: "Unhappy reviews",
    conditions: { stars: [1, 2] },
    templateKey: "negative",
    mode: "approval",
    delayMinutes: 30,
  },
  {
    name: "Mixed reviews",
    conditions: { stars: [3] },
    templateKey: "neutral",
    mode: "approval",
    delayMinutes: 60,
  },
  {
    name: "Thank happy reviewers",
    conditions: { stars: [4, 5] },
    templateKey: "thanks",
    mode: "approval",
    delayMinutes: 90,
  },
];
