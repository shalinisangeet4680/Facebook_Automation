import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  DELAYS,
  RATING_MODES,
  TEMPLATE_CATEGORIES,
  TONES,
} from "@modules/engine/domain/engine.types";

import { CTA_TYPES, POST_TYPES, WEEKDAYS } from "../../domain/business.types";
import { REVIEW_STATES } from "../../application/business-reviews.service";

export class BusinessQuietHoursDto {
  @IsString()
  start: string;

  @IsString()
  end: string;
}

export class BusinessRatingRuleDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsIn(RATING_MODES)
  mode: (typeof RATING_MODES)[number];

  @IsOptional()
  @IsUUID()
  templateId: string | null;
}

export class BusinessSettingsDto {
  @IsOptional()
  @IsIn(Object.keys(DELAYS))
  delay?: keyof typeof DELAYS;

  @IsOptional()
  @IsIn(TONES)
  tone?: (typeof TONES)[number];

  @IsOptional()
  @IsBoolean()
  translate?: boolean;

  @IsOptional()
  @IsBoolean()
  personalize?: boolean;

  @IsOptional()
  @IsBoolean()
  skipEmpty?: boolean;

  @IsOptional()
  @IsBoolean()
  escalate?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPause?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessQuietHoursDto)
  quietHours?: BusinessQuietHoursDto | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  dailyAutoLimit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  neverAutoWords?: string[];

  @IsOptional()
  @IsBoolean()
  replyToEdited?: boolean;
}

export class UpdateLocationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessSettingsDto)
  settings?: BusinessSettingsDto;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => BusinessRatingRuleDto)
  ratingRules?: BusinessRatingRuleDto[];
}

export class StartOAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;
}

export class OAuthCallbackQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  error?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  iss?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  authuser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hd?: string;
}

export class BusinessInboxQueryDto {
  @IsOptional()
  @IsIn(["pending", "replied", "all"])
  filter?: "pending" | "replied" | "all";

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Matches(/^[1-5](,[1-5]){0,4}$/)
  stars?: string;
}

export class BusinessReviewQueryDto {
  @IsOptional()
  @IsIn(REVIEW_STATES)
  state?: (typeof REVIEW_STATES)[number];

  @IsOptional()
  @Matches(/^[1-5](,[1-5]){0,4}$/)
  stars?: string;
}

export class BusinessRangeQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 7, 30, 90])
  days?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  all?: string;
}

export class BusinessReplyDto {
  @IsString()
  @MaxLength(4096)
  text: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class BusinessApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  text?: string;
}

export class BusinessApproveAllDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  replyIds: string[];
}

export class BusinessDraftDto {
  @IsOptional()
  @IsBoolean()
  rewrite?: boolean;
}

export class BusinessTemplateBodyDto {
  @IsString()
  @MaxLength(10)
  language: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(4096, { each: true })
  variants: string[];
}

export class BusinessTemplateDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @IsIn(TEMPLATE_CATEGORIES)
  category: (typeof TEMPLATE_CATEGORIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  ratings?: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BusinessTemplateBodyDto)
  bodies: BusinessTemplateBodyDto[];

  @IsOptional()
  @IsUUID()
  locationId?: string | null;
}

export class BusinessVisibilityDto {
  @IsBoolean()
  hidden: boolean;
}

export class PostCtaDto {
  @IsIn(CTA_TYPES)
  type: (typeof CTA_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url: string | null;
}

export class PostEventDto {
  @IsString()
  @MaxLength(58)
  title: string;

  @IsString()
  start: string;

  @IsString()
  end: string;
}

export class PostOfferDto {
  @IsOptional()
  @IsString()
  @MaxLength(58)
  couponCode: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  redeemUrl: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  terms: string | null;
}

export class PostContentDto {
  @IsIn(POST_TYPES)
  type: (typeof POST_TYPES)[number];

  @IsString()
  @MaxLength(1500)
  summary: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaUrl: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PostCtaDto)
  cta: PostCtaDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PostEventDto)
  event: PostEventDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PostOfferDto)
  offer: PostOfferDto | null;
}

export class UpdateGbpPostDto {
  @ValidateNested()
  @Type(() => PostContentDto)
  content: PostContentDto;

  @IsIn(["now", "schedule", "draft"])
  when: "now" | "schedule" | "draft";

  @IsOptional()
  @IsString()
  scheduledAt?: string | null;
}

export class CreateGbpPostDto extends UpdateGbpPostDto {
  @IsUUID()
  locationId: string;
}

export class PostQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class OpeningPeriodDto {
  @IsIn(WEEKDAYS)
  day: (typeof WEEKDAYS)[number];

  @Matches(/^\d{2}:\d{2}$/)
  open: string;

  @Matches(/^\d{2}:\d{2}$/)
  close: string;
}

export class InfoPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(750)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => OpeningPeriodDto)
  hours?: OpeningPeriodDto[];
}
