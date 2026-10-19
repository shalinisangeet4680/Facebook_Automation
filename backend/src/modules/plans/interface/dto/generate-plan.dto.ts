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
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { GOAL_NAMES } from "@modules/ads/domain/goals";
import { PREFILL_QUESTIONS } from "@modules/ads/domain/lead-form";

const HTTPS = { protocols: ["https"], require_protocol: true };

export class BriefRegionDto {
  @IsString()
  @Length(1, 40)
  key: string;

  @IsString()
  @Length(1, 200)
  name: string;
}

export class BriefCityDto extends BriefRegionDto {
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(80)
  radiusKm?: number | null;
}

export class BriefLocationsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^[A-Za-z]{2}$/, { each: true })
  countries?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BriefRegionDto)
  regions?: BriefRegionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => BriefCityDto)
  cities?: BriefCityDto[];
}

export class BriefPostDto {
  @IsIn(["facebook", "instagram"])
  platform: "facebook" | "instagram";

  @IsString()
  @Length(1, 80)
  id: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  permalink?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string | null;
}

export class BriefCreativeDto {
  @IsOptional()
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @IsUrl(HTTPS, { message: "imageUrl must be an https link" })
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BriefPostDto)
  post?: BriefPostDto | null;
}

export class BriefLeadFormDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(PREFILL_QUESTIONS, { each: true })
  questions?: ("FULL_NAME" | "EMAIL" | "PHONE" | "CITY")[];

  @IsOptional()
  @IsUrl(HTTPS, { message: "privacyPolicyUrl must be an https link" })
  @MaxLength(2000)
  privacyPolicyUrl?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      "callPhone must be the full phone number with country code, like +919876543210",
  })
  callPhone?: string | null;

  @IsOptional()
  @IsBoolean()
  extraQuestions?: boolean;
}

export class GenerateCampaignPlanDto {
  @IsIn(GOAL_NAMES)
  goal: "traffic" | "leads" | "instant_leads" | "sales" | "awareness";

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(10_000_000)
  dailyBudget: number;

  @ValidateNested()
  @Type(() => BriefLocationsDto)
  locations: BriefLocationsDto;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audienceNotes?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  offer: string;

  @IsOptional()
  @IsUrl(HTTPS, { message: "landingUrl must be an https link" })
  @MaxLength(2000)
  landingUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BriefCreativeDto)
  creative?: BriefCreativeDto;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  language?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BriefLeadFormDto)
  leadForm?: BriefLeadFormDto;
}

export class GeneratedCampaignPlanDto {
  id: string;
  name: string;
  dailyBudget: number;
  requestedDailyBudget: number;
  budgetClamped: boolean;
  currency: string;
  ai: boolean;
  usedTemplate: boolean;
}
