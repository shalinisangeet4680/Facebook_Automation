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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { RULE_MODES, TEMPLATE_CATEGORIES } from "../../domain/play.types";
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

export class PlaySettingsDto {
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
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  variants: string[];
}

export class TemplateDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @IsIn(TEMPLATE_CATEGORIES)
  category: (typeof TEMPLATE_CATEGORIES)[number];

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
