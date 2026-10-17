import { ServiceAccountKey } from "@modules/play/domain/ports/play-api";

export const PLAY_RELEASES_API = Symbol("PLAY_RELEASES_API");

export const RELEASE_STATUSES = [
  "draft",
  "inProgress",
  "halted",
  "completed",
] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export interface ReleaseNote {
  language: string;
  text: string;
}

export interface ReleaseData {
  name: string | null;
  versionCodes: string[];
  status: ReleaseStatus;
  userFraction: number | null;
  releaseNotes: ReleaseNote[];
}

export interface TrackData {
  track: string;
  releases: ReleaseData[];
}

export interface VitalsRow {
  day: string;
  versionCode: string;
  rate: number | null;
  users: number;
}

export const ISSUE_TYPES = ["CRASH", "ANR"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export interface ErrorIssueData {
  id: string;
  type: IssueType;
  cause: string;
  location: string;
  reports: number;
  users: number;
  firstVersionCode: string | null;
  lastVersionCode: string | null;
  issueUri: string | null;
}

export interface ErrorReportData {
  id: string;
  type: IssueType;
  reportText: string;
  eventTime: string;
  device: string | null;
  androidVersion: number | null;
  versionCode: string | null;
}

export interface PlayReleasesApi {
  listTracks(key: ServiceAccountKey, packageName: string): Promise<TrackData[]>;
  listingLanguages(
    key: ServiceAccountKey,
    packageName: string,
  ): Promise<string[]>;
  updateTrack(
    key: ServiceAccountKey,
    packageName: string,
    track: TrackData,
  ): Promise<TrackData>;
  vitals(
    key: ServiceAccountKey,
    packageName: string,
    metric: "crash" | "anr",
    days: number,
  ): Promise<VitalsRow[]>;
  errorIssues(
    key: ServiceAccountKey,
    packageName: string,
    type: IssueType | null,
  ): Promise<ErrorIssueData[]>;
  errorReports(
    key: ServiceAccountKey,
    packageName: string,
    issueId: string,
  ): Promise<ErrorReportData[]>;
}
