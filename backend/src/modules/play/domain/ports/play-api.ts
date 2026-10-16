export const PLAY_API = Symbol("PLAY_API");

export interface ServiceAccountKey {
  clientEmail: string;
  privateKey: string;
  projectId: string;
  tokenUri: string;
}

export interface PlayReviewData {
  reviewId: string;
  authorName: string;
  stars: number;
  text: string;
  originalText: string | null;
  language: string | null;
  lastModified: Date;
  appVersionName: string | null;
  appVersionCode: number | null;
  device: string | null;
  androidVersion: number | null;
  thumbsUp: number;
  reply: { text: string; lastModified: Date } | null;
}

export type PlayErrorKind =
  "auth" | "access" | "not_found" | "quota" | "invalid" | "unavailable";

export class PlayApiError extends Error {
  constructor(
    readonly kind: PlayErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PlayApiError";
  }
}

export interface PlayApi {
  verifyKey(key: ServiceAccountKey): Promise<void>;
  listReviews(
    key: ServiceAccountKey,
    packageName: string,
    options: { translationLanguage?: string },
  ): Promise<PlayReviewData[]>;
  reply(
    key: ServiceAccountKey,
    packageName: string,
    reviewId: string,
    text: string,
  ): Promise<{ text: string; lastModified: Date }>;
  listing(
    key: ServiceAccountKey,
    packageName: string,
  ): Promise<{ title: string | null; iconUrl: string | null }>;
}
