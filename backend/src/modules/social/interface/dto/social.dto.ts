import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { PLATFORMS } from "../../domain/post.rules";

export class CreatePostDto {
  @IsUUID()
  creativeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsIn(PLATFORMS, { each: true })
  platforms: ("facebook" | "instagram")[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(5000)
  facebookCaption?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2200)
  instagramCaption?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  scheduledAt?: string | null;
}

export class LibraryQueryDto {
  @IsIn(PLATFORMS)
  platform: "facebook" | "instagram";
}

export class PlatformResultDto {
  postId?: string | null;
  mediaId?: string | null;
  permalink: string | null;
  error: string | null;
}

export class SocialPostDto {
  id: string;
  creativeId: string | null;
  imageUrl: string;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  facebookCaption: string | null;
  instagramCaption: string | null;
  status:
    | "scheduled"
    | "publishing"
    | "published"
    | "partially_published"
    | "failed"
    | "cancelled";
  scheduledAt: string;
  publishedAt: string | null;
  facebook: PlatformResultDto | null;
  instagram: PlatformResultDto | null;
  source: string;
  createdAt: string;
}

export class SocialPostListDto {
  data: SocialPostDto[];
}

export class LibraryPostDto {
  id: string;
  platform: "facebook" | "instagram";
  text: string | null;
  imageUrl: string | null;
  permalink: string | null;
  createdAt: string;
  likes: number | null;
  comments: number | null;
  mediaType: string | null;
}

export class LibraryDto {
  connected: boolean;
  data: LibraryPostDto[];
}

export class ChannelDto {
  id: string;
  name?: string;
  username?: string;
}

export class ChannelsDto {
  facebook: ChannelDto | null;
  instagram: ChannelDto | null;
}
