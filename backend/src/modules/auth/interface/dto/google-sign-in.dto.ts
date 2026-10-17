import { IsOptional, IsString, MaxLength } from "class-validator";

export class GoogleStartQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  next?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hint?: string;
}

export class GoogleCallbackQueryDto {
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
