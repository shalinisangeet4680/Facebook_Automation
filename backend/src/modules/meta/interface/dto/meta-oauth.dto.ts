import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartMetaOAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  next?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;
}

export class MetaOAuthCallbackQueryDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  granted_scopes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  denied_scopes?: string;
}
