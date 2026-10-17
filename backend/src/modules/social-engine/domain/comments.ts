import {
  DEFAULT_SETTINGS,
  ReplySettings,
  ReviewFacts,
} from "@modules/engine/domain/engine.types";

import {
  AutopostSettings,
  COMMENT_CLASSES,
  CommentClass,
} from "./social.types";

const SPAM = [
  /https?:\/\//i,
  /bit\.ly|tinyurl|wa\.me/i,
  /free followers|followers? (for )?free|buy followers/i,
  /check (out )?my (profile|page|bio)/i,
  /\bdm (me|us|for)\b/i,
  /promo(te)? (your|ur)|collab\?|paid promotion/i,
  /crypto|bitcoin|forex|earn \S+ (daily|per day)|work from home/i,
  /follow (me|back)|f4f|l4l/i,
];

const COMPLAINT = [
  "worst",
  "bad",
  "rude",
  "waited",
  "waiting",
  "never again",
  "disappoint",
  "refund",
  "cheat",
  "fraud",
  "scam",
  "not happy",
  "poor",
  "terrible",
  "horrible",
  "complain",
  "overcharg",
  "no response",
  "nobody answers",
  "not working",
  "late",
  "wrong",
  "pathetic",
];

const PRAISE = [
  "love",
  "great",
  "amazing",
  "awesome",
  "best",
  "beautiful",
  "thank",
  "nice",
  "wow",
  "superb",
  "excellent",
  "fantastic",
  "congrat",
  "❤",
  "😍",
  "🔥",
  "👏",
  "🙌",
  "💯",
];

const QUESTION = [
  /\?/,
  /^(what|when|where|how|which|who|why|is|are|do|does|can|could|will|kya|kitna|kab|kaha|kaise)\b/i,
  /\b(price|cost|rate|timings?|open|available|address|location|book|appointment|delivery|charges)\b/i,
];

export function classifyComment(text: string): CommentClass {
  const t = text.trim();
  if (!t) return "other";
  if (SPAM.some((re) => re.test(t))) return "spam";
  const lower = ` ${t.toLowerCase()} `;
  if (COMPLAINT.some((w) => lower.includes(w))) return "complaint";
  if (QUESTION.some((re) => re.test(t))) return "question";
  if (PRAISE.some((w) => lower.includes(w))) return "praise";
  return "other";
}

export const CLASS_STARS: Record<CommentClass, number> = {
  praise: 5,
  question: 4,
  other: 3,
  complaint: 2,
  spam: 1,
};

export const STARS_CLASS: Record<number, CommentClass> = Object.fromEntries(
  COMMENT_CLASSES.map((c) => [CLASS_STARS[c], c]),
) as Record<number, CommentClass>;

export function commentFacts(comment: {
  externalId: string;
  author: string;
  text: string;
  class: CommentClass;
}): ReviewFacts {
  return {
    reviewId: comment.externalId,
    authorName: comment.author,
    stars: CLASS_STARS[comment.class],
    text: comment.text,
    originalText: null,
    language: null,
    appVersionName: null,
    editedAfterReply: false,
  };
}

export function commentReplySettings(
  settings: AutopostSettings,
): ReplySettings {
  return {
    ...DEFAULT_SETTINGS,
    timezone: settings.timezone,
    quietHours: settings.quietHours,
    dailyAutoLimit: settings.comments.dailyAutoLimit,
    neverAutoWords: settings.neverAutoWords,
    tone: settings.comments.tone,
    delay: "15m",
    skipEmpty: true,
    escalate: settings.comments.escalateComplaints,
    autoPause: settings.autoPause,
    ratingRules: COMMENT_CLASSES.map((c) => ({
      rating: CLASS_STARS[c],
      mode: c === "spam" ? "manual" : settings.comments.modes[c],
      templateId: null,
    })),
  };
}

export const COMMENT_TEMPLATES: Record<CommentClass, string> = {
  question:
    "Hi {user_name}, thanks for asking! Please send us a message or call {{phone|us}} and we'll help you right away.",
  praise: "Thank you so much, {user_name}! We're so glad you liked it. 🙏",
  complaint:
    "We're sorry to hear this, {user_name}. Please send us a message with the details so we can make it right.",
  spam: "",
  other: "Thanks for your comment, {user_name}!",
};
