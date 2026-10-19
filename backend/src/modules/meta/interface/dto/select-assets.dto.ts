import { IsOptional, IsString, Length } from "class-validator";

export class SelectAssetsDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  adAccountId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  pageId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  instagramId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  datasetId?: string;
}

export class SwitchAdAccountDto {
  @IsString()
  @Length(1, 64)
  adAccountId: string;
}
