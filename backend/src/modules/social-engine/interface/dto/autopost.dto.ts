import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { TONES } from "@modules/engine/domain/engine.types";

import {
  CONTENT_TYPES,
  LOGIN_KINDS,
  MEDIA_KINDS,
  POST_FORMATS,
  POST_MODES,
  SOCIAL_PLATFORMS,
  VOICES,
} from "../../domain/social.types";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class StartAutopostOAuthDto {
  @IsIn(LOGIN_KINDS)
  login: (typeof LOGIN_KINDS)[number];

  @IsIn(SOCIAL_PLATFORMS)
  product: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;
}

export class AutopostOAuthCallbackQueryDto {
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
  @MaxLength(200)
  error_reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  error_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error_message?: string;
}

export class AutopostPlatformQueryDto {
  @IsOptional()
  @IsIn(SOCIAL_PLATFORMS)
  platform?: (typeof SOCIAL_PLATFORMS)[number];
}

export class AutopostQuietHoursDto {
  @Matches(HHMM)
  start: string;

  @Matches(HHMM)
  end: string;
}

export class AutopostContentModesDto {
  @IsOptional()
  @IsIn(POST_MODES)
  tip?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  offer?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  behind_the_scenes?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  testimonial?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  festival?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  product?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  announcement?: (typeof POST_MODES)[number];
}

export class AutopostCommentModesDto {
  @IsOptional()
  @IsIn(POST_MODES)
  question?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  praise?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  complaint?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  spam?: (typeof POST_MODES)[number];

  @IsOptional()
  @IsIn(POST_MODES)
  other?: (typeof POST_MODES)[number];
}

export class AutopostCommentSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AutopostCommentModesDto)
  modes?: AutopostCommentModesDto;

  @IsOptional()
  @IsIn(TONES)
  tone?: (typeof TONES)[number];

  @IsOptional()
  @IsBoolean()
  hideSpam?: boolean;

  @IsOptional()
  @IsBoolean()
  escalateComplaints?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  dailyAutoLimit?: number;
}

export class UpdateAutopostAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutopostQuietHoursDto)
  quietHours?: AutopostQuietHoursDto | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(25)
  dailyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  weeklyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  postsPerWeek?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  neverAutoWords?: string[];

  @IsOptional()
  @IsBoolean()
  autoPause?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyPlan?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutopostContentModesDto)
  modes?: AutopostContentModesDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(POST_FORMATS, { each: true })
  formats?: (typeof POST_FORMATS)[number][];

  @IsOptional()
  @ValidateNested()
  @Type(() => AutopostCommentSettingsDto)
  comments?: AutopostCommentSettingsDto;
}

export class BrandColorsDto {
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primary?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  secondary?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accent?: string;
}

export class BrandFontsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  heading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  body?: string;
}

export class HashtagSetDto {
  @IsString()
  @MaxLength(40)
  name: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags: string[];
}

export class BrandKitPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  audience?: string;

  @IsOptional()
  @IsIn(VOICES)
  voice?: (typeof VOICES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  offers?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HashtagSetDto)
  hashtagSets?: HashtagSetDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  bannedWords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  logoUrl?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandColorsDto)
  colors?: BrandColorsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandFontsDto)
  fonts?: BrandFontsDto;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsIn(["en", "hi", "hinglish"])
  language?: string;
}

export class BrandKitQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class PrefillBrandKitDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsBoolean()
  save?: boolean;
}

export class GeneratePlanDto {
  @IsUUID()
  accountId: string;

  @IsOptional()
  @Matches(DAY)
  weekStart?: string;
}

export class AutopostPlansQueryDto {
  @IsIn(SOCIAL_PLATFORMS)
  platform: (typeof SOCIAL_PLATFORMS)[number];
}

export class AutopostCalendarQueryDto {
  @IsIn(SOCIAL_PLATFORMS)
  platform: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsString()
  @MaxLength(40)
  from: string;

  @IsString()
  @MaxLength(40)
  to: string;
}

export class AutopostPostsQueryDto {
  @IsOptional()
  @IsIn(SOCIAL_PLATFORMS)
  platform?: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AutopostMediaInputDto {
  @IsOptional()
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsIn(MEDIA_KINDS)
  kind?: (typeof MEDIA_KINDS)[number];
}

export class AutopostFieldsDto {
  @IsOptional()
  @IsIn(CONTENT_TYPES)
  contentType?: (typeof CONTENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  idea?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  hashtags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  firstComment?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  altText?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AutopostMediaInputDto)
  media?: AutopostMediaInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  link?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  collaborators?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  scheduledAt?: string | null;
}

export class UpdateAutopostDto extends AutopostFieldsDto {
  @IsOptional()
  @IsIn(POST_FORMATS)
  format?: (typeof POST_FORMATS)[number];
}

export class CreateAutopostDto extends AutopostFieldsDto {
  @IsUUID()
  accountId: string;

  @IsIn(POST_FORMATS)
  format: (typeof POST_FORMATS)[number];

  @IsIn(["draft", "approval", "schedule", "now"])
  when: "draft" | "approval" | "schedule" | "now";

  @IsOptional()
  @IsBoolean()
  generateCaption?: boolean;

  @IsOptional()
  @IsBoolean()
  generateImage?: boolean;
}

export class WriteAutopostDto {
  @IsUUID()
  accountId: string;

  @IsIn(POST_FORMATS)
  format: (typeof POST_FORMATS)[number];

  @IsIn(CONTENT_TYPES)
  contentType: (typeof CONTENT_TYPES)[number];

  @IsString()
  @MaxLength(500)
  idea: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  avoid?: string;
}

export class RegenerateAutopostDto {
  @IsIn(["caption", "image"])
  part: "caption" | "image";
}

export class ApproveAutopostsDto {
  @IsIn(SOCIAL_PLATFORMS)
  platform: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("all", { each: true })
  ids?: string[];
}

export class AutopostInsightsQueryDto {
  @IsIn(SOCIAL_PLATFORMS)
  platform: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days?: number;
}

export class AutopostCommentsQueryDto {
  @IsOptional()
  @IsIn(SOCIAL_PLATFORMS)
  platform?: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsIn(["open", "replied", "all"])
  filter?: "open" | "replied" | "all";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  classes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class AutopostCommentTextDto {
  @IsString()
  @MaxLength(2200)
  text: string;
}

export class AutopostCommentAiDraftDto {
  @IsOptional()
  @IsBoolean()
  rewrite?: boolean;
}

export class AutopostHideCommentDto {
  @IsBoolean()
  hidden: boolean;
}

export class AutopostApproveReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  text?: string;
}

export class AutopostApproveRepliesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("all", { each: true })
  replyIds: string[];
}
