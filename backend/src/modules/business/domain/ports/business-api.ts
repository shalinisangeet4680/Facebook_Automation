import {
  BusinessInfo,
  DailyMetrics,
  InfoPatch,
  PostContent,
} from "../business.types";

export const BUSINESS_API = Symbol("BUSINESS_API");

export const GBP_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/business.manage",
];

export interface GoogleGrant {
  refreshToken: string;
  email: string;
}

export interface GbpAccount {
  name: string;
  accountName: string;
  type: string;
}

export interface GbpLocation {
  name: string;
  info: BusinessInfo;
  placeId: string | null;
  mapsUri: string | null;
  newReviewUri: string | null;
  verified: boolean;
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: string;
  reviewerPhoto: string | null;
  stars: number;
  comment: string;
  createTime: Date;
  updateTime: Date;
  reply: { comment: string; updateTime: Date } | null;
}

export interface GbpReviewPage {
  reviews: GbpReview[];
  averageRating: number | null;
  totalReviewCount: number;
}

export interface GbpPost {
  name: string;
  searchUrl: string | null;
  state: string;
}

export interface GbpDailyMetric extends DailyMetrics {
  day: string;
}

export type BusinessApiErrorKind =
  "auth" | "access" | "not_found" | "quota" | "invalid" | "error";

export class BusinessApiError extends Error {
  constructor(
    readonly kind: BusinessApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "BusinessApiError";
  }
}

export interface BusinessApi {
  authUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<GoogleGrant>;
  accounts(refreshToken: string): Promise<GbpAccount[]>;
  locations(refreshToken: string, account: string): Promise<GbpLocation[]>;
  location(refreshToken: string, location: string): Promise<GbpLocation>;
  updateLocation(
    refreshToken: string,
    location: string,
    patch: InfoPatch,
  ): Promise<GbpLocation>;
  reviews(
    refreshToken: string,
    account: string,
    location: string,
  ): Promise<GbpReviewPage>;
  reply(refreshToken: string, reviewName: string, text: string): Promise<void>;
  deleteReply(refreshToken: string, reviewName: string): Promise<void>;
  createPost(
    refreshToken: string,
    account: string,
    location: string,
    post: PostContent,
  ): Promise<GbpPost>;
  deletePost(refreshToken: string, postName: string): Promise<void>;
  metrics(
    refreshToken: string,
    location: string,
    from: string,
    to: string,
  ): Promise<GbpDailyMetric[]>;
}
