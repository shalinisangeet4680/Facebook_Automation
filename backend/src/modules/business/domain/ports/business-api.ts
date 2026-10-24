import {
  BusinessInfo,
  DailyMetrics,
  InfoPatch,
  PostContent,
} from "../business.types";
import {
  BusinessCategory,
  GoogleSearchInput,
  NewBusiness,
  VerificationMethod,
} from "../profile.types";

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

export const PHOTO_CATEGORIES = [
  "COVER",
  "PROFILE",
  "LOGO",
  "EXTERIOR",
  "INTERIOR",
  "PRODUCT",
  "AT_WORK",
  "FOOD_AND_DRINK",
  "MENU",
  "COMMON_AREA",
  "ROOMS",
  "TEAMS",
  "ADDITIONAL",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const MEDIA_FORMATS = ["PHOTO", "VIDEO"] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];
export const MEDIA_SOURCES = ["owner", "customer"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export interface GbpMedia {
  name: string;
  format: MediaFormat;
  category: PhotoCategory | null;
  url: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  views: number | null;
  createTime: Date;
  source: MediaSource;
  author: string | null;
  authorPhoto: string | null;
}

export interface GbpDailyMetric extends DailyMetrics {
  day: string;
}

export interface GbpGoogleMatch {
  name: string;
  title: string;
  address: string | null;
  phone: string | null;
  category: string | null;
  placeId: string | null;
  mapsUri: string | null;
  requestAdminRightsUri: string | null;
}

export interface GbpVerificationOption {
  method: VerificationMethod;
  phone: string | null;
  email: string | null;
  emailEditable: boolean;
  address: string | null;
  contactName: string | null;
  deliveryDays: number | null;
}

export type GbpVerificationState = "PENDING" | "COMPLETED" | "FAILED";

export interface GbpVerification {
  name: string;
  method: VerificationMethod;
  state: GbpVerificationState;
  createTime: Date;
}

export interface GbpVerifyRequest {
  method: VerificationMethod;
  phone?: string;
  email?: string;
  contactName?: string;
  languageCode: string;
  address?: NewBusiness["address"];
}

export interface GbpVoiceOfMerchant {
  hasVoiceOfMerchant: boolean;
  hasBusinessAuthority: boolean;
  pendingVerification: boolean;
  waitingForGoogle: boolean;
  ownershipConflict: boolean;
  guidelinesIssue: string | null;
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
  media(
    refreshToken: string,
    account: string,
    location: string,
  ): Promise<GbpMedia[]>;
  addPhoto(
    refreshToken: string,
    account: string,
    location: string,
    photo: { sourceUrl: string; category: PhotoCategory },
  ): Promise<GbpMedia>;
  deleteMedia(refreshToken: string, name: string): Promise<void>;
  metrics(
    refreshToken: string,
    location: string,
    from: string,
    to: string,
  ): Promise<GbpDailyMetric[]>;
  categories(
    refreshToken: string,
    query: string,
    regionCode: string,
    languageCode: string,
  ): Promise<BusinessCategory[]>;
  searchGoogle(
    refreshToken: string,
    input: GoogleSearchInput,
  ): Promise<GbpGoogleMatch[]>;
  createLocation(
    refreshToken: string,
    account: string,
    business: NewBusiness,
    options: { validateOnly: boolean; requestId: string },
  ): Promise<GbpLocation | null>;
  createLocationGroup(
    refreshToken: string,
    name: string,
    primaryOwner: string,
  ): Promise<GbpAccount>;
  verificationOptions(
    refreshToken: string,
    location: string,
    languageCode: string,
    address: NewBusiness["address"],
  ): Promise<GbpVerificationOption[]>;
  verify(
    refreshToken: string,
    location: string,
    request: GbpVerifyRequest,
  ): Promise<GbpVerification>;
  completeVerification(
    refreshToken: string,
    verification: string,
    pin: string,
  ): Promise<GbpVerification>;
  verifications(
    refreshToken: string,
    location: string,
  ): Promise<GbpVerification[]>;
  voiceOfMerchant(
    refreshToken: string,
    location: string,
  ): Promise<GbpVoiceOfMerchant>;
}
