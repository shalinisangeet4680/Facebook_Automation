export const META_PUBLISHING = Symbol("META_PUBLISHING");

export interface PublishedPost {
  id: string;
  permalink: string | null;
}

export interface LibraryPost {
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

export interface MetaPublishing {
  publishFacebookPhoto(
    token: string,
    pageId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishedPost>;
  publishInstagramImage(
    token: string,
    instagramId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishedPost>;
  facebookPosts(
    token: string,
    pageId: string,
    limit: number,
  ): Promise<LibraryPost[]>;
  instagramPosts(
    token: string,
    instagramId: string,
    limit: number,
  ): Promise<LibraryPost[]>;
}
