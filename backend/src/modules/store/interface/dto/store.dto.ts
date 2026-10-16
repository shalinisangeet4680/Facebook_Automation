import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { CreativeDto } from "@modules/creatives/interface/dto/creative.dto";

import {
  ASSET_KINDS,
  LANG,
  PROJECT_STATUSES,
  SLUG,
  STORE_SIZES,
  STORE_STYLES,
} from "../../domain/store.rules";

export class StoreChoiceDto {
  @IsIn(STORE_STYLES)
  style: (typeof STORE_STYLES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(LANG, { each: true })
  languages: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(STORE_SIZES, { each: true })
  sizes: (typeof STORE_SIZES)[number][];
}

export class SaveStoreProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Matches(SLUG)
  slug?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Matches(LANG, { each: true })
  languages: string[];
}

export class StoreUploadTicketDto {
  projectId: string;
  url: string;
  uploadUrl: string;
  uploadToken: string;
  expiresAt: string;
}

export class AddToCreativesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsUUID("all", { each: true })
  assetIds: string[];
}

export class StoreCountsDto {
  screens: number;
  previews: number;
  screenshots: number;
  featureGraphics: number;
}

export class StoreProjectDto {
  id: string;
  slug: string;
  name: string;
  status: (typeof PROJECT_STATUSES)[number];
  languages: string[];
  choice: StoreChoiceDto | null;
  counts: StoreCountsDto;
  coverUrl: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export class StoreProjectListDto {
  data: StoreProjectDto[];
}

export class StoreAssetDto {
  id: string;
  kind: (typeof ASSET_KINDS)[number];
  name: string;
  style: string;
  lang: string;
  size: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export class StoreOptionsDto {
  styles: string[];
  featureStyles: string[];
  sizes: string[];
}

export class StoreProjectDetailDto extends StoreProjectDto {
  assets: StoreAssetDto[];
  options: StoreOptionsDto;
}

export class AddedCreativesDto {
  data: CreativeDto[];
}
