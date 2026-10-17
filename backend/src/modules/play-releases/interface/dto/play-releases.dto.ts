import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { HEALTH_DAYS } from "../../application/play-releases.service";
import { ISSUE_TYPES } from "../../domain/ports/releases-api";
import { PROMOTE_MODES, ROLLOUT_ACTIONS } from "../../domain/rollout";

const TRACK = /^[a-zA-Z0-9:_-]{1,64}$/;
const CODE = /^\d{1,12}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export class RolloutDto {
  @Matches(TRACK)
  track: string;

  @IsIn(ROLLOUT_ACTIONS)
  action: (typeof ROLLOUT_ACTIONS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  fraction?: number;
}

export class PromoteDto {
  @Matches(TRACK)
  fromTrack: string;

  @Matches(TRACK)
  toTrack: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(CODE, { each: true })
  versionCodes?: string[];

  @IsIn(PROMOTE_MODES)
  mode: (typeof PROMOTE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  fraction?: number;
}

export class ReleaseNoteDto {
  @Matches(LANGUAGE)
  language: string;

  @IsString()
  @MaxLength(2000)
  text: string;
}

export class SaveNotesDto {
  @Matches(TRACK)
  track: string;

  @Matches(CODE)
  versionCode: string;

  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ReleaseNoteDto)
  notes: ReleaseNoteDto[];
}

export class DraftNotesDto {
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  changelog: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versionName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @Matches(LANGUAGE, { each: true })
  languages?: string[];
}

export class GuardianDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  maxCrashRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  maxAnrRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minUsers?: number;
}

export class HealthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(HEALTH_DAYS)
  days?: (typeof HEALTH_DAYS)[number];
}

export class IssuesQueryDto {
  @IsOptional()
  @IsIn(ISSUE_TYPES)
  type?: (typeof ISSUE_TYPES)[number];
}
