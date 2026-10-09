import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class TargetingQueryDto {
  @IsIn(["city", "region", "country", "interest"])
  type: "city" | "region" | "country" | "interest";

  @IsString()
  @Length(2, 100)
  q: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}

export class TargetingOptionDto {
  key: string;
  name: string;
  type: string;
  region: string | null;
  countryCode: string | null;
  audienceSize: number | null;
}

export class TargetingResultsDto {
  results: TargetingOptionDto[];
}
