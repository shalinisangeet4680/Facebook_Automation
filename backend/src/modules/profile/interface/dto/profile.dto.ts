import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
} from "class-validator";

import { FACEBOOK_PARTS } from "../../domain/profile.draft";

export class FacebookDraftInputDto {
  about?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  pictureCreativeId?: string | null;
  coverCreativeId?: string | null;
}

export class InstagramDraftInputDto {
  name?: string | null;
  bio?: string | null;
  website?: string | null;
  pictureCreativeId?: string | null;
}

export class SaveProfileDraftDto {
  @IsOptional()
  @IsObject()
  facebook?: FacebookDraftInputDto;

  @IsOptional()
  @IsObject()
  instagram?: InstagramDraftInputDto;
}

export class ApplyFacebookDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(FACEBOOK_PARTS, { each: true })
  parts: (
    | "about"
    | "description"
    | "website"
    | "phone"
    | "email"
    | "picture"
    | "cover"
  )[];
}

export class ProfileCheckDto {
  key: string;
  label: string;
  status: "done" | "missing" | "weak";
  hint: string;
}

export class FacebookProfileDto {
  id: string;
  name: string;
  username: string | null;
  link: string | null;
  about: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  pictureUrl: string | null;
  pictureIsDefault: boolean;
  coverUrl: string | null;
  followers: number | null;
}

export class InstagramProfileDto {
  id: string;
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  pictureUrl: string | null;
  followers: number | null;
  posts: number | null;
}

export class FacebookCheckupDto {
  profile: FacebookProfileDto;
  checks: ProfileCheckDto[];
  score: number;
}

export class InstagramCheckupDto {
  profile: InstagramProfileDto;
  checks: ProfileCheckDto[];
  score: number;
}

export class DraftImageDto {
  id: string;
  name: string;
  url: string;
}

export class FacebookDraftDto {
  about: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  picture: DraftImageDto | null;
  cover: DraftImageDto | null;
}

export class InstagramDraftDto {
  name: string | null;
  bio: string | null;
  website: string | null;
  picture: DraftImageDto | null;
}

export class ProfileDraftDto {
  facebook: FacebookDraftDto;
  instagram: InstagramDraftDto;
}

export class ProfileCheckupDto {
  facebook: FacebookCheckupDto | null;
  instagram: InstagramCheckupDto | null;
  draft: ProfileDraftDto;
}

export class ApplyResultDto {
  part:
    | "about"
    | "description"
    | "website"
    | "phone"
    | "email"
    | "picture"
    | "cover";
  ok: boolean;
  error: string | null;
}

export class ApplyFacebookResponseDto {
  results: ApplyResultDto[];
  checkup: ProfileCheckupDto;
}
