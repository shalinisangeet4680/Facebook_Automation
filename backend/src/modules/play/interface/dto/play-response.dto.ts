import { ApiProperty } from "@nestjs/swagger";

import {
  AI_MODES,
  DELAYS,
  RATING_MODES,
  REPLY_SOURCES,
  REPLY_STATUSES,
  RULE_MODES,
  SYNC_ERROR_KINDS,
  TEMPLATE_CATEGORIES,
  TONES,
} from "../../domain/play.types";
import { REVIEW_STATES } from "../../application/play.service";

export class PlayConnectionDto {
  id: string;
  clientEmail: string;
  projectId: string;
  status: "active" | "error";
  error?: string | null;
  checkedAt?: string | null;
  discoveredAt?: string | null;
  discoveryError?: string | null;
  apps?: number;
}

export class DiscoveredAddedDto {
  id: string;
  packageName: string;
  title: string;
}

export class DiscoveredExistingDto {
  packageName: string;
  title: string;
}

export class DiscoveryFailureDto {
  packageName: string;
  title: string;
  reason: string;
}

export class DiscoveryResultDto {
  found: number;
  added: DiscoveredAddedDto[];
  already: DiscoveredExistingDto[];
  failed: DiscoveryFailureDto[];
  error: string | null;
}

export class ConnectResultDto extends PlayConnectionDto {
  discovery: DiscoveryResultDto;
}

export class PlayConnectionListDto {
  data: PlayConnectionDto[];
}

export class PlayAppDto {
  id: string;
  packageName: string;
  title: string;
  iconUrl: string | null;
  connectionId: string;
  connectionEmail: string | null;
  enabled: boolean;
  @ApiProperty({
    enum: ["auto", "approval", "manual", "mixed", "needs_access"],
  })
  mode: "auto" | "approval" | "manual" | "mixed" | "needs_access";
  rating: number | null;
  overallRating: number | null;
  previousRating: number | null;
  reviews30d: number;
  needsReply: number;
  waiting: number;
  needsClaude: number;
  scheduled: number;
  failed: number;
  @ApiProperty({ type: [Number] })
  replies14d: number[];
  lastSyncedAt: string | null;
  syncError: string | null;
  @ApiProperty({ enum: SYNC_ERROR_KINDS, nullable: true })
  syncErrorKind: (typeof SYNC_ERROR_KINDS)[number] | null;
  pausedUntil: string | null;
  pauseReason: string | null;
  @ApiProperty({ type: "array", items: { type: "number", nullable: true } })
  trend: (number | null)[];
}

export class PlayAppListDto {
  data: PlayAppDto[];
}

export class QuietHoursViewDto {
  start: string;
  end: string;
}

export class RatingRuleViewDto {
  rating: number;
  @ApiProperty({ enum: RATING_MODES })
  mode: (typeof RATING_MODES)[number];
  templateId: string | null;
}

export class PlaySettingsViewDto {
  timezone: string;
  quietHours: QuietHoursViewDto | null;
  dailyAutoLimit: number;
  neverAutoWords: string[];
  translateTo: string;
  replyToEdited: boolean;
  ratingRules: RatingRuleViewDto[];
  @ApiProperty({ enum: Object.keys(DELAYS) })
  delay: keyof typeof DELAYS;
  @ApiProperty({ enum: TONES })
  tone: (typeof TONES)[number];
  translate: boolean;
  personalize: boolean;
  skipEmpty: boolean;
  escalate: boolean;
  autoPause: boolean;
}

export class SeriesPointDto {
  day: string;
  reviews: number;
  replied: number;
  rating: number | null;
}

export class DistributionDto {
  stars: number;
  count: number;
  pct: number;
}

export class PeriodStatsDto {
  reviews: number;
  written: number;
  replied: number;
  replyRate: number | null;
  medianResponseMinutes: number | null;
  rating: number | null;
}

export class AppOverviewDto extends PeriodStatsDto {
  series: SeriesPointDto[];
  distribution: DistributionDto[];
}

export class TopicTrendDto {
  topic: string;
  count: number;
  previous: number;
  change: number | null;
  negative: boolean;
}

export class PlayAnalyticsDto {
  days: number;
  current: PeriodStatsDto;
  previous: PeriodStatsDto;
  repliesSent: number;
  timeSavedHours: number;
  series: SeriesPointDto[];
  distribution: DistributionDto[];
  topics: TopicTrendDto[];
}

export class SyncResultDto {
  fetched: number;
  created: number;
  updated: number;
  drafts: number;
}

export class PlayAppDetailDto extends PlayAppDto {
  automation: boolean;
  settings: PlaySettingsViewDto;
  @ApiProperty({ type: "object", additionalProperties: { type: "string" } })
  variables: Record<string, string>;
  latestVersion: string | null;
  builtInVariables: string[];
  suggestedVariables: string[];
  firstSync?: SyncResultDto | null;
  overview: AppOverviewDto;
}

export class ReplyViewDto {
  id: string;
  text: string;
  @ApiProperty({ enum: REPLY_STATUSES })
  status: (typeof REPLY_STATUSES)[number];
  @ApiProperty({ enum: REPLY_SOURCES })
  source: (typeof REPLY_SOURCES)[number];
  templateId: string | null;
  ruleId: string | null;
  auto: boolean;
  note: string | null;
  error: string | null;
  sendAt: string | null;
  sentAt: string | null;
}

export class PostedReplyDto {
  text: string;
  repliedAt: string | null;
}

export class SentViaDto {
  auto: boolean;
  @ApiProperty({ enum: REPLY_SOURCES })
  source: (typeof REPLY_SOURCES)[number];
  sentAt: string | null;
}

export class PlayReviewDto {
  id: string;
  reviewId: string;
  authorName: string;
  stars: number;
  text: string;
  originalText: string | null;
  language: string | null;
  appVersionName: string | null;
  device: string | null;
  androidVersion: number | null;
  thumbsUp: number;
  reviewedAt: string;
  reply: PostedReplyDto | null;
  editedAfterReply: boolean;
  starsBeforeEdit: number | null;
  canReply: boolean;
  topic: string | null;
  skippedAt: string | null;
  sentVia: SentViaDto | null;
  @ApiProperty({ enum: REVIEW_STATES })
  state: (typeof REVIEW_STATES)[number];
  draft: ReplyViewDto | null;
}

export class PlayInboxReviewDto extends PlayReviewDto {
  appId: string;
}

export class PlayInboxCountsDto {
  pending: number;
  replied: number;
  all: number;
}

export class PlayInboxDto {
  data: PlayInboxReviewDto[];
  counts: PlayInboxCountsDto;
  approvable: string[];
}

export class ApproveAllFailureDto {
  replyId: string;
  error: string;
}

export class ApproveAllResultDto {
  sent: number;
  failed: ApproveAllFailureDto[];
}

export class WorkspaceSettingsViewDto {
  @ApiProperty({ enum: AI_MODES })
  aiMode: (typeof AI_MODES)[number];
  platformAi: boolean;
  aiKeyHint: string | null;
  aiReady: boolean;
  model: string;
  dailyDrafts: number;
  draftsToday: number;
  slackConnected: boolean;
  slackChannel: string | null;
  agentsCanPost: boolean;
  mcpUrl: string;
  token: string | null;
  tokenCreatedAt: string | null;
  apps: number;
  connected: boolean;
}

export class AccessTokenDto {
  token: string;
}

export class McpClientDto {
  id: string;
  name: string;
  @ApiProperty({ enum: ["token", "oauth"] })
  kind: "token" | "oauth";
  lastUsedAt: string | null;
  lastTool: string | null;
  connectedAt: string | null;
}

export class McpClientListDto {
  data: McpClientDto[];
}

export class ReviewCountsDto {
  unreplied: number;
  waiting: number;
  claude: number;
  scheduled: number;
  failed: number;
  replied: number;
  skipped: number;
}

export class PlayReviewListDto {
  data: PlayReviewDto[];
  total: number;
  page: number;
  pageSize: number;
  counts: ReviewCountsDto;
  languages: string[];
  versions: string[];
}

export class ReplyPreviewDto {
  text: string;
  missing: string[];
  tooLong: boolean;
  language: string | null;
  length: number;
  max: number;
  note: string | null;
}

export class HeldReviewDto {
  reviewId: string;
  note: string;
}

export class FailedReviewDto {
  reviewId: string;
  error: string;
}

export class BulkReplyResultDto {
  sent: number;
  held: HeldReviewDto[];
  failed: FailedReviewDto[];
}

export class TemplateBodyViewDto {
  language: string;
  variants: string[];
}

export class TemplateUsageDto {
  ruleId: string;
  name: string;
  appId: string;
}

export class TemplateProblemDto {
  language: string;
  variant: number;
  problem: string;
}

export class PlayTemplateDto {
  id: string;
  name: string;
  @ApiProperty({ enum: TEMPLATE_CATEGORIES })
  category: (typeof TEMPLATE_CATEGORIES)[number];
  bodies: TemplateBodyViewDto[];
  appId: string | null;
  presetKey: string | null;
  builtIn: boolean;
  @ApiProperty({ type: [Number] })
  ratings: number[];
  usedBy: TemplateUsageDto[];
  problems: TemplateProblemDto[];
  updatedAt: string;
}

export class PlayTemplateListDto {
  data: PlayTemplateDto[];
  categories: string[];
  builtInVariables: string[];
  suggestedVariables: string[];
}

export class TemplateSampleDto {
  language: string;
  variant: number;
  text: string;
  length: number;
  missing: string[];
}

export class TemplateCheckDto {
  problems: TemplateProblemDto[];
  samples: TemplateSampleDto[];
}

export class RestoredPresetsDto {
  restored: number;
}

export class RuleConditionsViewDto {
  stars?: number[];
  keywordsAny?: string[];
  keywordsNone?: string[];
  languages?: string[];
  appVersions?: string[];
  edited?: boolean;
}

export class RuleActionViewDto {
  @ApiProperty({ enum: ["template", "claude", "skip"] })
  type: "template" | "claude" | "skip";
  templateId?: string;
}

export class PlayRuleDto {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleConditionsViewDto;
  action: RuleActionViewDto;
  @ApiProperty({ enum: RULE_MODES })
  mode: (typeof RULE_MODES)[number];
  delayMinutes: number;
}

export class PlayRuleListDto {
  data: PlayRuleDto[];
}

export class InsightPointDto {
  start: string;
  @ApiProperty({ type: [Number] })
  stars: number[];
  total: number;
  rating: number | null;
}

export class VersionInsightDto {
  version: string;
  reviews: number;
  rating: number;
}

export class LanguageInsightDto {
  language: string;
  reviews: number;
}

export class WordInsightDto {
  word: string;
  reviews: number;
}

export class PlayInsightsDto {
  days: number;
  weekly: boolean;
  rating: number | null;
  previousRating: number | null;
  reviews: number;
  previousReviews: number;
  textReviews: number;
  replyRate: number | null;
  previousReplyRate: number | null;
  medianReplyHours: number | null;
  @ApiProperty({ type: [Number] })
  distribution: number[];
  series: InsightPointDto[];
  versions: VersionInsightDto[];
  languages: LanguageInsightDto[];
  complaints: WordInsightDto[];
  praise: WordInsightDto[];
}

export class ImportResultDto {
  rows: number;
  imported: number;
  alreadyHere: number;
  skipped: number;
  ratingOnly: number;
  from: string;
  to: string;
}
