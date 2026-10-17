import { ApiProperty } from "@nestjs/swagger";

import { ISSUE_TYPES, RELEASE_STATUSES } from "../../domain/ports/releases-api";

export class ReleaseNoteViewDto {
  language: string;
  text: string;
}

export class ReleaseViewDto {
  name: string | null;
  versionCodes: string[];
  @ApiProperty({ enum: RELEASE_STATUSES })
  status: (typeof RELEASE_STATUSES)[number];
  userFraction: number | null;
  rolloutPercent: number | null;
  notes: ReleaseNoteViewDto[];
}

export class TrackViewDto {
  track: string;
  label: string;
  @ApiProperty({ enum: ["production", "testing", "custom"] })
  kind: "production" | "testing" | "custom";
  releases: ReleaseViewDto[];
}

export class GuardianDefaultsDto {
  maxCrashRate: number;
  maxAnrRate: number;
  minUsers: number;
}

export class GuardianViewDto {
  enabled: boolean;
  maxCrashRate: number;
  maxAnrRate: number;
  minUsers: number;
  defaults: GuardianDefaultsDto;
  ignoredVersion: string | null;
  lastCheckedAt: string | null;
  @ApiProperty({
    enum: ["ok", "waiting", "halted", "idle", "error"],
    nullable: true,
    type: String,
  })
  lastStatus: string | null;
  lastMessage: string | null;
}

export class GuardianCheckDto extends GuardianViewDto {
  halted: string[];
}

export class ReleaseEventDto {
  id: string;
  kind: string;
  track: string;
  versionCodes: string[];
  message: string;
  @ApiProperty({ enum: ["user", "claude", "guardian"], type: String })
  actor: string;
  createdAt: string;
}

export class ReleasesAppDto {
  id: string;
  title: string;
  packageName: string;
  iconUrl: string | null;
}

export class ReleasesOverviewDto {
  app: ReleasesAppDto;
  tracks: TrackViewDto[];
  languages: string[];
  noteMax: number;
  guardian: GuardianViewDto;
  events: ReleaseEventDto[];
}

export class TrackChangeDto {
  summary: string;
  track: TrackViewDto;
}

export class DraftedNoteDto {
  language: string;
  text: string;
  length: number;
}

export class DraftedNotesDto {
  languages: string[];
  noteMax: number;
  notes: DraftedNoteDto[];
}

export class RatePointDto {
  day: string;
  users: number;
  rate: number | null;
}

export class VersionHealthDto {
  versionCode: string;
  name: string | null;
  crashRate: number | null;
  anrRate: number | null;
  users: number;
  overCrash: boolean;
  overAnr: boolean;
}

export class ThresholdsDto {
  crash: number;
  anr: number;
  googleCrash: number;
  googleAnr: number;
}

export class ActiveRolloutDto {
  track: string;
  label: string;
  versionCodes: string[];
  name: string | null;
  @ApiProperty({ enum: RELEASE_STATUSES })
  status: (typeof RELEASE_STATUSES)[number];
  rolloutPercent: number | null;
}

export class HealthAppDto {
  id: string;
  title: string;
  packageName: string;
}

export class AppHealthDto {
  app: HealthAppDto;
  days: number;
  thresholds: ThresholdsDto;
  crash: RatePointDto[];
  anr: RatePointDto[];
  versions: VersionHealthDto[];
  rollouts: ActiveRolloutDto[];
  guardian: GuardianViewDto;
}

export class ErrorIssueDto {
  id: string;
  @ApiProperty({ enum: ISSUE_TYPES })
  type: (typeof ISSUE_TYPES)[number];
  cause: string;
  location: string;
  reports: number;
  users: number;
  firstVersionCode: string | null;
  lastVersionCode: string | null;
  issueUri: string | null;
}

export class ErrorIssueListDto {
  data: ErrorIssueDto[];
}

export class ErrorReportDto {
  id: string;
  @ApiProperty({ enum: ISSUE_TYPES })
  type: (typeof ISSUE_TYPES)[number];
  reportText: string;
  eventTime: string;
  device: string | null;
  androidVersion: number | null;
  versionCode: string | null;
}

export class CountDto {
  value: string;
  count: number;
}

export class ErrorIssueDetailDto {
  issue: ErrorIssueDto;
  reports: ErrorReportDto[];
  devices: CountDto[];
  androidVersions: CountDto[];
  files: string[];
}

export class CrashExplanationDto {
  issueId: string;
  summary: string;
  cause: string;
  fix: string;
  files: string[];
}
