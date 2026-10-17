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
}
