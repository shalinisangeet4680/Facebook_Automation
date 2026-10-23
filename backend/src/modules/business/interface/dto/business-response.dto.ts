import { ApiProperty } from "@nestjs/swagger";

import {
  DELAYS,
  RATING_MODES,
  REPLY_SOURCES,
  REPLY_STATUSES,
  TEMPLATE_CATEGORIES,
  TONES,
} from "@modules/engine/domain/engine.types";

import {
  CTA_TYPES,
  POST_STATUSES,
  POST_TYPES,
  WEEKDAYS,
} from "../../domain/business.types";
import {
  PHOTO_CATEGORIES,
  PhotoCategory,
} from "../../domain/ports/business-api";
import {
  VERIFICATION_METHODS,
  VERIFICATION_STATES,
} from "../../domain/profile.types";
import { REVIEW_STATES } from "../../application/business-reviews.service";

export class BusinessStatusDto {
  configured: boolean;
  mock: boolean;
  redirectUri: string;
}

export class ConnectUrlDto {
  url: string;
}

export class GbpConnectionDto {
  id: string;
  email: string;
  @ApiProperty({ enum: ["active", "error"] })
  status: "active" | "error";
  error: string | null;
  discoveredAt: string | null;
  locations: number;
  createdAt: string;
}

export class GbpConnectionListDto {
  data: GbpConnectionDto[];
}

export class DiscoveredLocationDto {
  id: string;
  title: string;
}

export class LocationDiscoveryDto {
  found: number;
  added: DiscoveredLocationDto[];
  restored: DiscoveredLocationDto[];
  already: DiscoveredLocationDto[];
  error: string | null;
}

export class SyncAllResultDto {
  synced: number;
  failed: number;
  added: number;
  restored: number;
  error: string | null;
}

export class LocationSyncResultDto {
  fetched: number;
  created: number;
  updated: number;
  drafts: number;
  archived: boolean;
}

export class OpeningPeriodViewDto {
  @ApiProperty({ enum: WEEKDAYS })
  day: (typeof WEEKDAYS)[number];
  open: string;
  close: string;
}

export class BusinessAddressDto {
  lines: string[];
  locality: string;
  region: string;
  postalCode: string;
  country: string;
}

export class ServiceAreaViewDto {
  regionCode: string;
  places: string[];
}

export class BusinessInfoDto {
  title: string;
  description: string;
  phone: string | null;
  website: string | null;
  address: BusinessAddressDto | null;
  serviceArea?: ServiceAreaViewDto | null;
  primaryCategory: string | null;
  additionalCategories: string[];
  hours: OpeningPeriodViewDto[];
}

export class GbpLocationDto {
  id: string;
  title: string;
  address: string | null;
  category: string | null;
  rating: number | null;
  totalReviews: number;
  reviews30d: number;
  needsReply: number;
  waiting: number;
  @ApiProperty({ enum: ["auto", "approval", "manual", "mixed"] })
  mode: "auto" | "approval" | "manual" | "mixed";
  verified: boolean;
  @ApiProperty({ enum: VERIFICATION_STATES })
  verificationState: (typeof VERIFICATION_STATES)[number];
  @ApiProperty({ enum: VERIFICATION_METHODS, nullable: true, type: String })
  verificationMethod: string | null;
  createdInApp: boolean;
  mapsUri: string | null;
  newReviewUri: string | null;
  connectionId: string;
  connectionEmail: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  pausedUntil: string | null;
  pauseReason: string | null;
}

export class GbpLocationListDto {
  data: GbpLocationDto[];
}

export class BusinessQuietHoursViewDto {
  start: string;
  end: string;
}

export class BusinessRatingRuleViewDto {
  rating: number;
  @ApiProperty({ enum: RATING_MODES })
  mode: (typeof RATING_MODES)[number];
  templateId: string | null;
}

export class BusinessSettingsViewDto {
  timezone: string;
  quietHours: BusinessQuietHoursViewDto | null;
  dailyAutoLimit: number;
  neverAutoWords: string[];
  translateTo: string;
  replyToEdited: boolean;
  ratingRules: BusinessRatingRuleViewDto[];
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

export class GbpLocationDetailDto extends GbpLocationDto {
  info: BusinessInfoDto;
  placeId: string | null;
  settings: BusinessSettingsViewDto;
  variables: Record<string, string>;
}

export class BusinessReplyViewDto {
  id: string;
  text: string;
  @ApiProperty({ enum: REPLY_STATUSES })
  status: (typeof REPLY_STATUSES)[number];
  @ApiProperty({ enum: REPLY_SOURCES })
  source: (typeof REPLY_SOURCES)[number];
  templateId: string | null;
  auto: boolean;
  note: string | null;
  error: string | null;
  sendAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export class BusinessReplyTextDto {
  text: string;
  repliedAt: string | null;
}

export class BusinessSentViaDto {
  auto: boolean;
  @ApiProperty({ enum: REPLY_SOURCES })
  source: (typeof REPLY_SOURCES)[number];
  sentAt: string | null;
}

export class GbpReviewDto {
  id: string;
  locationId: string;
  reviewId: string;
  authorName: string;
  authorPhoto: string | null;
  stars: number;
  text: string;
  language: string | null;
  reviewedAt: string;
  reply: BusinessReplyTextDto | null;
  editedAfterReply: boolean;
  starsBeforeEdit: number | null;
  topic: string | null;
  skippedAt: string | null;
  sentVia: BusinessSentViaDto | null;
  @ApiProperty({ enum: REVIEW_STATES })
  state: (typeof REVIEW_STATES)[number];
  draft: BusinessReplyViewDto | null;
}

export class GbpReviewListDto {
  data: GbpReviewDto[];
  total: number;
  counts: Record<string, number>;
}

export class BusinessInboxCountsDto {
  pending: number;
  replied: number;
  all: number;
}

export class BusinessInboxDto {
  data: GbpReviewDto[];
  counts: BusinessInboxCountsDto;
  approvable: string[];
}

export class BusinessApproveFailureDto {
  replyId: string;
  error: string;
}

export class BusinessApproveAllResultDto {
  sent: number;
  failed: BusinessApproveFailureDto[];
}

export class BusinessPeriodStatsDto {
  reviews: number;
  written: number;
  replied: number;
  replyRate: number | null;
  medianResponseMinutes: number | null;
  rating: number | null;
}

export class BusinessSeriesPointDto {
  day: string;
  reviews: number;
  replied: number;
  rating: number | null;
}

export class BusinessDistributionDto {
  stars: number;
  count: number;
  pct: number;
}

export class BusinessTopicTrendDto {
  topic: string;
  count: number;
  previous: number;
  change: number | null;
  negative: boolean;
}

export class BusinessAnalyticsDto {
  days: number;
  from: string;
  to: string;
  @ApiProperty({ enum: ["day", "week", "month"] })
  bucket: "day" | "week" | "month";
  current: BusinessPeriodStatsDto;
  previous: BusinessPeriodStatsDto;
  repliesSent: number;
  timeSavedHours: number;
  series: BusinessSeriesPointDto[];
  distribution: BusinessDistributionDto[];
  topics: BusinessTopicTrendDto[];
}

export class BusinessTemplateBodyViewDto {
  language: string;
  variants: string[];
}

export class GbpTemplateDto {
  id: string;
  name: string;
  @ApiProperty({ enum: TEMPLATE_CATEGORIES })
  category: (typeof TEMPLATE_CATEGORIES)[number];
  bodies: BusinessTemplateBodyViewDto[];
  ratings: number[];
  hidden: boolean;
  preset: boolean;
  locationId: string | null;
  updatedAt: string;
}

export class GbpTemplateListDto {
  data: GbpTemplateDto[];
}

export class PostCtaViewDto {
  @ApiProperty({ enum: CTA_TYPES })
  type: (typeof CTA_TYPES)[number];
  url: string | null;
}

export class PostEventViewDto {
  title: string;
  start: string;
  end: string;
}

export class PostOfferViewDto {
  couponCode: string | null;
  redeemUrl: string | null;
  terms: string | null;
}

export class PostContentViewDto {
  @ApiProperty({ enum: POST_TYPES })
  type: (typeof POST_TYPES)[number];
  summary: string;
  mediaUrl: string | null;
  cta: PostCtaViewDto | null;
  event: PostEventViewDto | null;
  offer: PostOfferViewDto | null;
}

export class GbpPostDto {
  id: string;
  locationId: string;
  @ApiProperty({ enum: POST_TYPES })
  type: (typeof POST_TYPES)[number];
  content: PostContentViewDto;
  @ApiProperty({ enum: POST_STATUSES })
  status: (typeof POST_STATUSES)[number];
  scheduledAt: string | null;
  publishedAt: string | null;
  searchUrl: string | null;
  error: string | null;
  source: string;
  createdAt: string;
}

export class GbpPostListDto {
  data: GbpPostDto[];
}

export class LocationInfoDto {
  info: BusinessInfoDto;
  mapsUri: string | null;
  newReviewUri: string | null;
  verified: boolean;
}

export class GbpPhotoDto {
  name: string;
  @ApiProperty({ enum: PHOTO_CATEGORIES })
  category: PhotoCategory;
  url: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  views: number | null;
  createTime: string;
}

export class GbpPhotoListDto {
  photos: GbpPhotoDto[];
  error: string | null;
}

export class InfoPreviewDto {
  changes: string[];
  problems: string[];
}

export class MetricsDto {
  impressionsMaps: number;
  impressionsSearch: number;
  calls: number;
  websiteClicks: number;
  directions: number;
  conversations: number;
  bookings: number;
}

export class MetricsPointDto extends MetricsDto {
  day: string;
}

export class BusinessInsightsDto {
  from: string;
  to: string;
  days: number;
  current: MetricsDto;
  previous: MetricsDto;
  series: MetricsPointDto[];
  lastDay: string | null;
  note: string;
}

export class BusinessSuggestionDto {
  key: string;
  value: string;
  source: string;
  count: number;
  current: string | null;
}

export class BusinessSuggestionListDto {
  data: BusinessSuggestionDto[];
}

export class BusinessDashboardDto {
  locations: number;
  needsReply: number;
  scheduledPosts: number;
  publishedPosts30d: number;
}
