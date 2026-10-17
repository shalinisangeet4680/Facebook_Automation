import {
  DEFAULT_NEVER_AUTO_WORDS,
  QuietHours,
  Tone,
} from "@modules/engine/domain/engine.types";
import {
  CAPTION_LIMITS,
  MAX_HASHTAGS,
} from "@modules/social/domain/post.rules";

export const SOCIAL_PLATFORMS = ["instagram", "facebook"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const LOGIN_KINDS = ["facebook", "instagram"] as const;
export type LoginKind = (typeof LOGIN_KINDS)[number];

export const ACCOUNT_STATUSES = ["active", "error"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const POST_FORMATS = [
  "image",
  "carousel",
  "reel",
  "story",
  "multi_image",
  "video",
  "text",
  "link",
] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export const FORMATS_BY_PLATFORM: Record<SocialPlatform, PostFormat[]> = {
  instagram: ["image", "carousel", "reel", "story"],
  facebook: ["image", "multi_image", "video", "text", "link"],
};

export const FORMAT_LABELS: Record<PostFormat, string> = {
  image: "Image",
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
  multi_image: "Multi-image",
  video: "Video or Reel",
  text: "Text",
  link: "Link",
};

export const CONTENT_TYPES = [
  "tip",
  "offer",
  "behind_the_scenes",
  "testimonial",
  "festival",
  "product",
  "announcement",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_LABELS: Record<ContentType, string> = {
  tip: "Tip",
  offer: "Offer",
  behind_the_scenes: "Behind the scenes",
  testimonial: "Testimonial",
  festival: "Festival or local event",
  product: "Product or service",
  announcement: "Announcement",
};

export const POST_STATUSES = [
  "draft",
  "pending_approval",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_MODES = ["auto", "approval", "manual"] as const;
export type PostMode = (typeof POST_MODES)[number];

export const COMMENT_CLASSES = [
  "question",
  "praise",
  "complaint",
  "spam",
  "other",
] as const;
export type CommentClass = (typeof COMMENT_CLASSES)[number];

export const VOICES = ["friendly", "professional", "playful"] as const;
export type Voice = (typeof VOICES)[number];

export const MEDIA_KINDS = ["image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface MediaItem {
  url: string;
  kind: MediaKind;
  creativeId: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface HashtagSet {
  name: string;
  tags: string[];
}

export interface BrandKit {
  name: string;
  businessType: string;
  audience: string;
  voice: Voice;
  topics: string[];
  offers: string[];
  hashtagSets: HashtagSet[];
  bannedWords: string[];
  logoUrl: string | null;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  cta: string;
  link: string | null;
  websiteUrl: string | null;
  city: string | null;
  language: string;
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: "",
  businessType: "",
  audience: "",
  voice: "friendly",
  topics: [],
  offers: [],
  hashtagSets: [],
  bannedWords: [],
  logoUrl: null,
  colors: { primary: "#191917", secondary: "#F4F1EA", accent: "#E4572E" },
  fonts: { heading: "Helvetica", body: "Helvetica" },
  cta: "",
  link: null,
  websiteUrl: null,
  city: null,
  language: "en",
};

export function defined<T extends object>(value: T | null | undefined) {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function normalizeBrandKit(
  raw: Partial<BrandKit> | null | undefined,
): BrandKit {
  return {
    ...DEFAULT_BRAND_KIT,
    ...raw,
    colors: { ...DEFAULT_BRAND_KIT.colors, ...raw?.colors },
    fonts: { ...DEFAULT_BRAND_KIT.fonts, ...raw?.fonts },
  };
}

export interface CommentSettings {
  modes: Record<CommentClass, PostMode>;
  tone: Tone;
  hideSpam: boolean;
  escalateComplaints: boolean;
  dailyAutoLimit: number;
}

export interface AutopostSettings {
  timezone: string;
  quietHours: QuietHours | null;
  dailyLimit: number;
  weeklyLimit: number;
  postsPerWeek: number;
  neverAutoWords: string[];
  autoPause: boolean;
  weeklyPlan: boolean;
  modes: Record<ContentType, PostMode>;
  formats: PostFormat[];
  comments: CommentSettings;
}

export const DEFAULT_COMMENT_SETTINGS: CommentSettings = {
  modes: {
    question: "approval",
    praise: "approval",
    complaint: "approval",
    spam: "manual",
    other: "approval",
  },
  tone: "friendly",
  hideSpam: true,
  escalateComplaints: true,
  dailyAutoLimit: 50,
};

export function defaultSettings(platform: SocialPlatform): AutopostSettings {
  return {
    timezone: "Asia/Kolkata",
    quietHours: { start: "22:00", end: "08:00" },
    dailyLimit: 2,
    weeklyLimit: 10,
    postsPerWeek: 4,
    neverAutoWords: DEFAULT_NEVER_AUTO_WORDS,
    autoPause: true,
    weeklyPlan: true,
    modes: {
      tip: "approval",
      offer: "approval",
      behind_the_scenes: "approval",
      testimonial: "approval",
      festival: "approval",
      product: "approval",
      announcement: "approval",
    },
    formats:
      platform === "instagram"
        ? ["image", "carousel", "reel"]
        : ["image", "text", "link"],
    comments: DEFAULT_COMMENT_SETTINGS,
  };
}

export function normalizeAutopostSettings(
  platform: SocialPlatform,
  raw: Partial<AutopostSettings> | null | undefined,
): AutopostSettings {
  const base = defaultSettings(platform);
  return {
    ...base,
    ...raw,
    modes: { ...base.modes, ...raw?.modes },
    formats: (raw?.formats ?? base.formats).filter((f) =>
      FORMATS_BY_PLATFORM[platform].includes(f),
    ),
    comments: {
      ...base.comments,
      ...raw?.comments,
      modes: { ...base.comments.modes, ...raw?.comments?.modes },
    },
  };
}

export interface PostContent {
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  altText: string | null;
  media: MediaItem[];
  link: string | null;
  location: string | null;
  collaborators: string[];
}

export const INSTAGRAM_POSTS_PER_DAY = 100;
export const STORY_SECONDS = 60;

export function fullCaption(
  content: Pick<PostContent, "caption" | "hashtags">,
) {
  const tags = content.hashtags
    .map((t) => t.trim().replace(/^#*/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`);
  return [content.caption.trim(), tags.join(" ")].filter(Boolean).join("\n\n");
}

const hashtagCount = (text: string) =>
  (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

const isHttps = (url: string | null) => {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

export function checkPost(
  platform: SocialPlatform,
  format: PostFormat,
  content: PostContent,
): string[] {
  const problems: string[] = [];
  const name = platform === "instagram" ? "Instagram" : "Facebook";
  if (!FORMATS_BY_PLATFORM[platform].includes(format)) {
    problems.push(`${name} doesn't support ${FORMAT_LABELS[format]} posts.`);
    return problems;
  }
  const text = fullCaption(content);
  const images = content.media.filter((m) => m.kind === "image").length;
  const videos = content.media.filter((m) => m.kind === "video").length;
  const total = content.media.length;
  if (text.length > CAPTION_LIMITS[platform])
    problems.push(
      `The caption is longer than ${CAPTION_LIMITS[platform]} characters.`,
    );
  if (platform === "instagram" && hashtagCount(text) > MAX_HASHTAGS)
    problems.push(`Instagram allows at most ${MAX_HASHTAGS} hashtags.`);
  switch (format) {
    case "image":
      if (total !== 1 || images !== 1) problems.push("Add exactly one image.");
      break;
    case "carousel":
    case "multi_image":
      if (total < 2 || total > 10)
        problems.push("Add between 2 and 10 images or videos.");
      if (format === "multi_image" && videos)
        problems.push("Facebook multi-image posts take images only.");
      break;
    case "reel":
    case "video":
      if (total !== 1 || videos !== 1)
        problems.push(
          format === "reel"
            ? "Add one vertical video for the Reel."
            : "Add one video.",
        );
      for (const m of content.media.filter((v) => v.kind === "video")) {
        const seconds = m.durationSeconds ?? 0;
        if (seconds && (seconds < 3 || seconds > 900))
          problems.push("Videos must be between 3 seconds and 15 minutes.");
      }
      break;
    case "story":
      if (total !== 1) problems.push("A Story takes one image or one video.");
      for (const m of content.media.filter((v) => v.kind === "video")) {
        if ((m.durationSeconds ?? 0) > STORY_SECONDS)
          problems.push("Story videos can be at most 60 seconds.");
      }
      if (content.firstComment)
        problems.push("Stories can't have a first comment.");
      break;
    case "text":
      if (total) problems.push("Text posts don't take images or videos.");
      if (!content.caption.trim()) problems.push("Write the post text.");
      break;
    case "link":
      if (total) problems.push("Link posts use the link's preview image.");
      if (!isHttps(content.link)) problems.push("Add an https link.");
      break;
  }
  if (format !== "link" && content.link && !isHttps(content.link))
    problems.push("Links must start with https://.");
  if (platform === "instagram" && format !== "story" && !text)
    problems.push("Write a caption.");
  if (content.collaborators.length > 3)
    problems.push("Tag at most 3 collaborators.");
  if (content.firstComment && content.firstComment.length > 2200)
    problems.push("The first comment is too long.");
  if (content.altText && content.altText.length > 1000)
    problems.push("Alt text can be at most 1000 characters.");
  for (const m of content.media)
    if (!isHttps(m.url) && !m.url.startsWith("http://localhost"))
      problems.push("Media must be hosted on an https URL.");
  return [...new Set(problems)];
}

export function bannedWordIn(text: string, words: string[]): string | null {
  const lower = text.toLowerCase();
  return (
    words.find((w) => w.trim() && lower.includes(w.trim().toLowerCase())) ??
    null
  );
}

export interface PostMetricValues {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoPlays: number;
}

export const EMPTY_POST_METRICS: PostMetricValues = {
  reach: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  videoPlays: 0,
};

export interface AccountMetricValues {
  followers: number;
  profileVisits: number;
  reach: number;
  impressions: number;
}

export const engagementOf = (m: PostMetricValues) =>
  m.likes + m.comments + m.shares + m.saves;

export interface BestTimeSlot {
  weekday: number;
  hour: number;
  score: number;
}

export interface BestTimes {
  source: "own" | "default";
  slots: BestTimeSlot[];
  heatmap: number[][];
  basedOn: number;
}
