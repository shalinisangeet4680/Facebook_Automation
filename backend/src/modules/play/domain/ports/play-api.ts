export const PLAY_API = Symbol("PLAY_API");

export interface ServiceAccountKey {
  clientEmail: string;
  privateKey: string;
  projectId: string;
  tokenUri: string;
}

export interface ManagedAccount {
  clientEmail: string;
  projectId: string;
}

export type PlayCredentials = ServiceAccountKey | ManagedAccount;

export const isKey = (c: PlayCredentials): c is ServiceAccountKey =>
  "privateKey" in c;

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
  | "auth"
  | "access"
  | "not_found"
  | "quota"
  | "invalid"
  | "unavailable"
  | "disabled";

export class PlayApiError extends Error {
  constructor(
    readonly kind: PlayErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PlayApiError";
  }
}

export interface DiscoveredApp {
  packageName: string;
  displayName: string | null;
}

export interface ReportFile {
  name: string;
  updated: string;
  size: number;
}

export interface AppListing {
  title: string | null;
  iconUrl: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactWebsite?: string | null;
}

export interface PlayApi {
  createAccount(
    accountId: string,
    displayName: string,
  ): Promise<ManagedAccount>;
  deleteAccount(account: ManagedAccount): Promise<void>;
  listReports(
    key: PlayCredentials,
    bucket: string,
    prefix: string,
  ): Promise<ReportFile[]>;
  downloadReport(
    key: PlayCredentials,
    bucket: string,
    name: string,
  ): Promise<Buffer>;
  listApps(key: PlayCredentials): Promise<DiscoveredApp[]>;
  verifyKey(key: PlayCredentials): Promise<void>;
  listReviews(
    key: PlayCredentials,
    packageName: string,
    options: { translationLanguage?: string },
  ): Promise<PlayReviewData[]>;
  reply(
    key: PlayCredentials,
    packageName: string,
    reviewId: string,
    text: string,
  ): Promise<{ text: string; lastModified: Date }>;
  listing(key: PlayCredentials, packageName: string): Promise<AppListing>;
}
