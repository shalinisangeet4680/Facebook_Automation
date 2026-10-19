import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { GOAL_NAMES } from "@modules/ads/domain/goals";

export class UpdateWorkspaceDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsNumber()
  @IsPositive()
  @Max(10_000_000)
  maxDailyBudget: number;

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsPositive()
  monthlyBudget: number | null;

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsPositive()
  targetCostPerResult: number | null;
}

export class UpdateBusinessBasicsDto {
  @ValidateIf((_, v) => v !== null)
  @IsUrl(
    { protocols: ["https"], require_protocol: true },
    { message: "Use the full website address starting with https://." },
  )
  @MaxLength(300)
  websiteUrl: string | null;

  @IsString()
  @Length(3, 300)
  offer: string;

  @IsString()
  @Length(2, 120)
  area: string;

  @IsString()
  @Length(2, 80)
  category: string;

  @IsString()
  @Length(2, 40)
  language: string;
}

export class UpdateGoalBudgetDto {
  @IsIn(GOAL_NAMES)
  goal: "traffic" | "leads" | "sales" | "awareness";

  @IsNumber()
  @IsPositive()
  @Max(10_000_000)
  dailyBudget: number;

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsPositive()
  monthlyBudget: number | null;

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsPositive()
  targetCostPerResult: number | null;
}

export class UpdateProfileDto {
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Length(1, 80)
  name: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  email: string | null;
}

export class SettingsWorkspaceDto {
  id: string;
  name: string;
}

export class SettingsProfileDto {
  name: string | null;
  email: string | null;
  phone: string;
}

export class SettingsBudgetDto {
  currency: string;
  maxDailyBudget: number;
  platformMaxDailyBudget: number;
  monthlyBudget: number | null;
  targetCostPerResult: number | null;
  goal: "traffic" | "leads" | "sales" | "awareness" | null;
}

export class BusinessBasicsDto {
  websiteUrl: string | null;
  offer: string | null;
  area: string | null;
  category: string | null;
  language: string | null;
}

export class SettingsResponseDto {
  workspace: SettingsWorkspaceDto;
  profile: SettingsProfileDto;
  budget: SettingsBudgetDto;
  business: BusinessBasicsDto;
}
