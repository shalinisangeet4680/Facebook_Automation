import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class AuthorizationQueryDto {
  @IsString()
  @Length(1, 32)
  response_type: string;

  @IsString()
  @Length(1, 2000)
  client_id: string;

  @IsString()
  @Length(1, 2000)
  redirect_uri: string;

  @IsString()
  @Length(1, 200)
  code_challenge: string;

  @IsString()
  @Length(1, 16)
  code_challenge_method: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  state?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  scope?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  resource?: string;
}

export class AuthorizationDecisionDto extends AuthorizationQueryDto {
  @Type(() => Boolean)
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allowWrite?: boolean;
}
