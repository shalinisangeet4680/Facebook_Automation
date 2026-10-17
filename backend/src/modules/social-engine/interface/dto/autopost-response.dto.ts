import { ApiProperty } from "@nestjs/swagger";

import {
  REPLY_SOURCES,
  REPLY_STATUSES,
  TONES,
} from "@modules/engine/domain/engine.types";

import {
  ACCOUNT_STATUSES,
  COMMENT_CLASSES,
  CONTENT_TYPES,
  LOGIN_KINDS,
  MEDIA_KINDS,
  POST_FORMATS,
  POST_MODES,
  POST_STATUSES,
  SOCIAL_PLATFORMS,
  VOICES,
} from "../../domain/social.types";

type Mode = (typeof POST_MODES)[number];

export class AutopostStatusDto {
  mock: boolean;
  facebookLogin: boolean;
  instagramLogin: boolean;
  redirectUri: string;
  facebookScopes: string[];
  instagramScopes: string[];
}

export class AutopostConnectUrlDto {
  url: string;
}

export class AutopostAccountDto {
  id: string;
  @ApiProperty({ enum: SOCIAL_PLATFORMS })
  platform: (typeof SOCIAL_PLATFORMS)[number];
  @ApiProperty({ enum: LOGIN_KINDS })
  login: (typeof LOGIN_KINDS)[number];
  externalId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  category: string | null;
  pageId: string | null;
  @ApiProperty({ enum: ACCOUNT_STATUSES })
  status: (typeof ACCOUNT_STATUSES)[number];
  error: string | null;
  followers: number;
  tokenExpiresAt: string | null;
  pausedUntil: string | null;
  pauseReason: string | null;
  commentsSyncedAt: string | null;
  metricsSyncedAt: string | null;
  pendingPosts: number;
  scheduledPosts: number;
  openComments: number;
  waitingReplies: number;
  createdAt: string;
}

export class AutopostAccountListDto {
  data: AutopostAccountDto[];
}

export class AutopostQuietHoursViewDto {
  start: string;
  end: string;
}

export class AutopostContentModesViewDto {
  @ApiProperty({ enum: POST_MODES })
  tip: Mode;
  @ApiProperty({ enum: POST_MODES })
  offer: Mode;
  @ApiProperty({ enum: POST_MODES })
  behind_the_scenes: Mode;
  @ApiProperty({ enum: POST_MODES })
  testimonial: Mode;
  @ApiProperty({ enum: POST_MODES })
  festival: Mode;
  @ApiProperty({ enum: POST_MODES })
  product: Mode;
  @ApiProperty({ enum: POST_MODES })
  announcement: Mode;
}

export class AutopostCommentModesViewDto {
  @ApiProperty({ enum: POST_MODES })
  question: Mode;
  @ApiProperty({ enum: POST_MODES })
  praise: Mode;
  @ApiProperty({ enum: POST_MODES })
  complaint: Mode;
  @ApiProperty({ enum: POST_MODES })
  spam: Mode;
  @ApiProperty({ enum: POST_MODES })
  other: Mode;
}

export class AutopostCommentSettingsViewDto {
  modes: AutopostCommentModesViewDto;
  @ApiProperty({ enum: TONES })
  tone: (typeof TONES)[number];
  hideSpam: boolean;
  escalateComplaints: boolean;
  dailyAutoLimit: number;
}

export class AutopostSettingsViewDto {
  timezone: string;
  quietHours: AutopostQuietHoursViewDto | null;
  dailyLimit: number;
  weeklyLimit: number;
  postsPerWeek: number;
  neverAutoWords: string[];
  autoPause: boolean;
  weeklyPlan: boolean;
  modes: AutopostContentModesViewDto;
  @ApiProperty({ enum: POST_FORMATS, isArray: true })
  formats: (typeof POST_FORMATS)[number][];
  comments: AutopostCommentSettingsViewDto;
}

export class BestTimeSlotDto {
  weekday: number;
  hour: number;
  score: number;
}

export class BestTimesDto {
  @ApiProperty({ enum: ["own", "default"] })
  source: "own" | "default";
  slots: BestTimeSlotDto[];
  @ApiProperty({
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  heatmap: number[][];
  basedOn: number;
}

export class AutopostAccountDetailDto extends AutopostAccountDto {
  settings: AutopostSettingsViewDto;
  bestTimes: BestTimesDto;
}

export class AutopostCommentSyncDto {
  fetched: number;
  created: number;
  hidden: number;
  drafts: number;
}

export class AutopostMetricsSyncDto {
  posts: number;
  days: number;
}

export class AutopostSyncResultDto {
  comments: AutopostCommentSyncDto;
  metrics: AutopostMetricsSyncDto;
}

export class BrandColorsViewDto {
  primary: string;
  secondary: string;
  accent: string;
}

export class BrandFontsViewDto {
  heading: string;
  body: string;
}

export class HashtagSetViewDto {
  name: string;
  tags: string[];
}

export class BrandKitViewDto {
  name: string;
  businessType: string;
  audience: string;
  @ApiProperty({ enum: VOICES })
  voice: (typeof VOICES)[number];
  topics: string[];
  offers: string[];
  hashtagSets: HashtagSetViewDto[];
  bannedWords: string[];
  logoUrl: string | null;
  colors: BrandColorsViewDto;
  fonts: BrandFontsViewDto;
  cta: string;
  link: string | null;
  websiteUrl: string | null;
  city: string | null;
  language: string;
}

export class BrandKitResponseDto {
  accountId: string | null;
  custom: boolean;
  saved: boolean;
  prefilledAt: string | null;
  kit: BrandKitViewDto;
  suggested?: boolean;
}

export class AutopostMediaDto {
  url: string;
  @ApiProperty({ enum: MEDIA_KINDS })
  kind: (typeof MEDIA_KINDS)[number];
  creativeId: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export class AutopostPostDto {
  id: string;
  accountId: string;
  accountName: string;
  planId: string | null;
  @ApiProperty({ enum: SOCIAL_PLATFORMS })
  platform: (typeof SOCIAL_PLATFORMS)[number];
  @ApiProperty({ enum: POST_FORMATS })
  format: (typeof POST_FORMATS)[number];
  @ApiProperty({ enum: CONTENT_TYPES })
  contentType: (typeof CONTENT_TYPES)[number];
  idea: string | null;
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  altText: string | null;
  media: AutopostMediaDto[];
  link: string | null;
  location: string | null;
  collaborators: string[];
  @ApiProperty({ enum: POST_STATUSES })
  status: (typeof POST_STATUSES)[number];
  @ApiProperty({ enum: POST_MODES })
  mode: Mode;
  heldReason: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  permalink: string | null;
  error: string | null;
  source: string;
  aiWritten: boolean;
  problems: string[];
  createdAt: string;
  updatedAt: string;
}

export class AutopostPostListDto {
  data: AutopostPostDto[];
}

export class AutopostPlanDto {
  id: string;
  accountId: string;
  weekStart: string;
  summary: string;
  source: string;
  createdAt: string;
}

export class AutopostPlanListDto {
  data: AutopostPlanDto[];
}

export class AutopostPlanResultDto {
  plan: AutopostPlanDto;
  posts: AutopostPostDto[];
}

export class AutopostCalendarDto {
  data: AutopostPostDto[];
  plans: AutopostPlanDto[];
}

export class AutopostWrittenDto {
  headline: string;
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  altText: string | null;
  ai: boolean;
}

export class AutopostCheckDto {
  problems: string[];
}

export class AutopostFailureDto {
  id: string;
  error: string;
}

export class AutopostApproveAllResultDto {
  approved: number;
  failed: AutopostFailureDto[];
}

export class AutopostMetricValuesDto {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoPlays: number;
}

export class AutopostTotalsDto {
  posts: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoPlays: number;
  engagement: number;
  engagementRate: number | null;
}

export class AutopostFollowersDto {
  total: number;
  change: number;
}

export class AutopostSeriesPointDto {
  day: string;
  followers: number;
  profileVisits: number;
  reach: number;
}

export class AutopostInsightPostDto {
  id: string;
  accountId: string;
  caption: string;
  @ApiProperty({ enum: POST_FORMATS })
  format: (typeof POST_FORMATS)[number];
  @ApiProperty({ enum: CONTENT_TYPES })
  contentType: (typeof CONTENT_TYPES)[number];
  permalink: string | null;
  publishedAt: string;
  imageUrl: string | null;
  metrics: AutopostMetricValuesDto;
  engagement: number;
}

export class AutopostFormatStatDto {
  @ApiProperty({ enum: POST_FORMATS })
  format: (typeof POST_FORMATS)[number];
  key: string;
  posts: number;
  avgEngagement: number;
  avgReach: number;
}

export class AutopostContentStatDto {
  @ApiProperty({ enum: CONTENT_TYPES })
  contentType: (typeof CONTENT_TYPES)[number];
  key: string;
  posts: number;
  avgEngagement: number;
  avgReach: number;
}

export class AutopostClassCountDto {
  @ApiProperty({ enum: COMMENT_CLASSES })
  class: (typeof COMMENT_CLASSES)[number];
  count: number;
}

export class AutopostThemeDto {
  word: string;
  reviews: number;
}

export class AutopostCommentStatsDto {
  total: number;
  replyRate: number | null;
  medianResponseMinutes: number | null;
  classes: AutopostClassCountDto[];
  themes: AutopostThemeDto[];
}

export class AutopostInsightsDto {
  days: number;
  current: AutopostTotalsDto;
  previous: AutopostTotalsDto;
  followers: AutopostFollowersDto;
  profileVisits: number;
  series: AutopostSeriesPointDto[];
  topPosts: AutopostInsightPostDto[];
  posts: AutopostInsightPostDto[];
  byFormat: AutopostFormatStatDto[];
  byContentType: AutopostContentStatDto[];
  bestTimes: BestTimesDto;
  comments: AutopostCommentStatsDto;
  recommendations: string[];
}

export class AutopostCommentReplyViewDto {
  text: string;
  at: string | null;
}

export class AutopostCommentDraftDto {
  id: string;
  text: string;
  @ApiProperty({ enum: REPLY_STATUSES })
  status: (typeof REPLY_STATUSES)[number];
  @ApiProperty({ enum: REPLY_SOURCES })
  source: (typeof REPLY_SOURCES)[number];
  auto: boolean;
  note: string | null;
  sendAt: string | null;
  error: string | null;
}

export class AutopostCommentDto {
  id: string;
  accountId: string;
  accountName: string;
  @ApiProperty({ enum: SOCIAL_PLATFORMS })
  platform: (typeof SOCIAL_PLATFORMS)[number];
  postId: string | null;
  postCaption: string | null;
  postPermalink: string | null;
  author: string;
  text: string;
  @ApiProperty({ enum: COMMENT_CLASSES })
  class: (typeof COMMENT_CLASSES)[number];
  commentedAt: string;
  hidden: boolean;
  @ApiProperty({
    enum: [
      "open",
      "waiting",
      "scheduled",
      "replied",
      "hidden",
      "skipped",
      "failed",
    ],
  })
  state:
    | "open"
    | "waiting"
    | "scheduled"
    | "replied"
    | "hidden"
    | "skipped"
    | "failed";
  reply: AutopostCommentReplyViewDto | null;
  draft: AutopostCommentDraftDto | null;
  escalatedAt: string | null;
}

export class AutopostCommentCountsDto {
  open: number;
  waiting: number;
}

export class AutopostCommentListDto {
  counts: AutopostCommentCountsDto;
  data: AutopostCommentDto[];
}

export class AutopostApproveRepliesResultDto {
  sent: number;
  failed: AutopostFailureDto[];
}
