import {
  TemplateBody,
  TemplateCategory,
} from "@modules/engine/domain/engine.types";

export interface BusinessPreset {
  key: string;
  name: string;
  category: TemplateCategory;
  ratings: number[];
  bodies: TemplateBody[];
}

const body = (...variants: string[]): TemplateBody[] => [
  { language: "en", variants },
];

export const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    key: "visit_thanks",
    name: "Thanks for visiting",
    category: "positive",
    ratings: [5],
    bodies: body(
      "Thank you so much, {user_name}! We’re delighted you had a great experience at {business_name}. We look forward to seeing you again. – {{team_name|The team}}",
      "Hi {user_name}, thanks for the kind words and the {rating}-star review! It means a lot to everyone at {business_name}. See you next time. – {{team_name|The team}}",
    ),
  },
  {
    key: "visit_nudge",
    name: "Thanks + what would make it 5",
    category: "positive",
    ratings: [4],
    bodies: body(
      "Thanks for visiting {business_name}, {user_name}! We’re glad you liked it. If there’s one thing we could do better, please tell us at {{phone|the front desk}}. – {{team_name|The team}}",
    ),
  },
  {
    key: "visit_follow_up",
    name: "Neutral follow-up",
    category: "neutral",
    ratings: [3],
    bodies: body(
      "Hi {user_name}, thank you for the honest feedback. We’d like to make your next visit to {business_name} better. Please reach us at {{phone|the front desk}} so we can help. – {{team_name|The team}}",
    ),
  },
  {
    key: "visit_apology",
    name: "Apology & make it right",
    category: "negative",
    ratings: [1, 2],
    bodies: body(
      "{user_name}, we’re sorry your visit to {business_name} wasn’t what you expected. This isn’t the experience we want for anyone. Please call us at {{phone|the clinic}} or write to {{support_email|us}} so we can make it right. – {{team_name|The team}}",
    ),
  },
];

export const BUSINESS_RATING_PRESETS: Record<number, string> = {
  5: "visit_thanks",
  4: "visit_nudge",
  3: "visit_follow_up",
  2: "visit_apology",
  1: "visit_apology",
};
