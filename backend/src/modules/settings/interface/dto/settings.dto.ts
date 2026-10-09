import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  ValidateIf,
} from "class-validator";

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
}

export class SettingsResponseDto {
  workspace: SettingsWorkspaceDto;
  profile: SettingsProfileDto;
  budget: SettingsBudgetDto;
}
