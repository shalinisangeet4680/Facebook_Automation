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
  MinLength,
  ValidateNested,
} from "class-validator";

import {
  AI_MODES,
  DELAYS,
  RATING_MODES,
  RULE_MODES,
  TEMPLATE_CATEGORIES,
  TONES,
} from "@modules/engine/domain/engine.types";
import { REVIEW_STATES } from "../../application/play.service";

export class ConnectPlayDto {
  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  key: string;
}

export class AddPlayAppDto {
  @IsUUID()
  connectionId: string;

  @IsString()
  @MaxLength(150)
  packageName: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

export class QuietHoursDto {
  @IsString()
  start: string;

  @IsString()
  end: string;
}

export class RatingRuleDto {
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

export class PlaySettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => RatingRuleDto)
  ratingRules?: RatingRuleDto[];

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
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  dailyAutoLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  neverAutoWords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  translateTo?: string;

  @IsOptional()
  @IsBoolean()
  replyToEdited?: boolean;
}

export class UpdatePlayAppDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  automation?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaySettingsDto)
  settings?: PlaySettingsDto;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

export class ReviewQueryDto {
  @IsOptional()
  @IsIn(REVIEW_STATES)
  state?: (typeof REVIEW_STATES)[number];

  @IsOptional()
  @IsString()
  stars?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class ApproveReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;
}

export class BulkReplyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  reviewIds: string[];

  @IsUUID()
  templateId: string;
}

export class PreviewDto {
  @IsUUID()
  reviewId: string;

  @IsUUID()
  templateId: string;
}

export class TemplateBodyDto {
  @IsString()
  @MaxLength(10)
  language: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  variants: string[];
}

export class TemplateDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsIn(TEMPLATE_CATEGORIES)
  category?: (typeof TEMPLATE_CATEGORIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  ratings?: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TemplateBodyDto)
  bodies: TemplateBodyDto[];

  @IsOptional()
  @IsUUID()
  appId?: string | null;
}

export class CheckTemplateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TemplateBodyDto)
  bodies: TemplateBodyDto[];

  @IsOptional()
  @IsUUID()
  appId?: string | null;
}

export class RuleConditionsDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  stars?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywordsAny?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywordsNone?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appVersions?: string[];

  @IsOptional()
  @IsBoolean()
  edited?: boolean;
}

export class RuleActionDto {
  @IsIn(["template", "claude", "skip"])
  type: "template" | "claude" | "skip";

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class RuleDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(60)
  name: string;

  @IsBoolean()
  enabled: boolean;

  @ValidateNested()
  @Type(() => RuleConditionsDto)
  conditions: RuleConditionsDto;

  @ValidateNested()
  @Type(() => RuleActionDto)
  action: RuleActionDto;

  @IsIn(RULE_MODES)
  mode: (typeof RULE_MODES)[number];

  @IsInt()
  @Min(0)
  @Max(1440)
  delayMinutes: number;
}

export class ReplaceRulesDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RuleDto)
  rules: RuleDto[];
}

export class PlayInboxQueryDto {
  @IsOptional()
  @IsIn(["pending", "replied", "all"])
  filter?: "pending" | "replied" | "all";

  @IsOptional()
  @IsUUID()
  appId?: string;

  @IsOptional()
  @Matches(/^[1-5](,[1-5]){0,4}$/)
  stars?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  appId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
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

export class ApproveAllDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  replyIds: string[];
}

export class WorkspaceSettingsDto {
  @IsOptional()
  @IsIn(AI_MODES)
  aiMode?: (typeof AI_MODES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  aiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  slackWebhook?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(81)
  slackChannel?: string | null;

  @IsOptional()
  @IsBoolean()
  agentsCanPost?: boolean;
}

export class ReportsBucketDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  uri: string | null;
}

export class TemplateVisibilityDto {
  @IsBoolean()
  hidden: boolean;
}
