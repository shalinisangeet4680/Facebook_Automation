export const META_PROFILE = Symbol("META_PROFILE");

export interface FacebookProfile {
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

export interface InstagramProfile {
  id: string;
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  pictureUrl: string | null;
  followers: number | null;
  posts: number | null;
}

export interface FacebookProfileUpdate {
  about?: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
}

export interface MetaProfile {
  facebook(token: string, pageId: string): Promise<FacebookProfile>;
  instagram(token: string, instagramId: string): Promise<InstagramProfile>;
  updateFacebook(
    token: string,
    pageId: string,
    update: FacebookProfileUpdate,
  ): Promise<void>;
  setFacebookCover(
    token: string,
    pageId: string,
    imageUrl: string,
  ): Promise<void>;
  setFacebookPicture(
    token: string,
    pageId: string,
    imageUrl: string,
  ): Promise<void>;
}
