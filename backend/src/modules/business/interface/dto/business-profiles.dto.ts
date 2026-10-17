import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { VERIFICATION_METHODS } from "../../domain/profile.types";
import { OpeningPeriodDto } from "./business.dto";

export class CategoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  region?: string;

  @IsOptional()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  language?: string;
}

export class GoogleSearchDto {
  @IsString()
  @MaxLength(100)
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  regionCode?: string;
}

export class CategoryDto {
  @Matches(/^categories\/[\w:.-]+$/)
  name: string;

  @IsString()
  @MaxLength(120)
  displayName: string;
}

export class NewAddressDto {
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  lines: string[];

  @IsString()
  @MaxLength(80)
  locality: string;

  @IsString()
  @MaxLength(80)
  region: string;

  @IsString()
  @MaxLength(20)
  postalCode: string;

  @Matches(/^[A-Za-z]{2}$/)
  country: string;
}

export class ServiceAreaDto {
  @Matches(/^[A-Za-z]{2}$/)
  regionCode: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  places: string[];
}

export class NewBusinessDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryDto)
  primaryCategory: CategoryDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  additionalCategories?: CategoryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(750)
  description?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => NewAddressDto)
  address?: NewAddressDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceAreaDto)
  serviceArea?: ServiceAreaDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => OpeningPeriodDto)
  hours?: OpeningPeriodDto[];
}

export class CreateProfileDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string | null;

  @IsOptional()
  @Matches(/^accounts\/\d+$/)
  account?: string | null;

  @ValidateNested()
  @Type(() => NewBusinessDto)
  business: NewBusinessDto;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}

export class CreateGroupDto {
  @IsUUID()
  connectionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}

export class StartVerificationDto {
  @IsIn(VERIFICATION_METHODS)
  method: (typeof VERIFICATION_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string | null;
}

export class CompleteVerificationDto {
  @IsString()
  @MaxLength(20)
  code: string;
}
