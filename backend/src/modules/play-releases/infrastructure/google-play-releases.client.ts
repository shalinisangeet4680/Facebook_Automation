import {
  PlayApiError,
  PlayCredentials,
} from "@modules/play/domain/ports/play-api";

import {
  ErrorIssueData,
  ErrorReportData,
  IssueType,
  PlayReleasesApi,
  ReleaseData,
  ReleaseStatus,
  TrackData,
  VitalsRow,
} from "../domain/ports/releases-api";

const PUBLISHER =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const REPORTING = "https://playdeveloperreporting.googleapis.com/v1beta1/apps";
const REPORTING_SCOPE =
  "https://www.googleapis.com/auth/playdeveloperreporting";
const ZONE = "America/Los_Angeles";

type Fetch = typeof fetch;

export interface TokenSource {
  token(key: PlayCredentials, scope: string): Promise<string>;
}

interface ApiRelease {
  name?: string;
  versionCodes?: string[];
  status?: string;
  userFraction?: number;
  releaseNotes?: { language?: string; text?: string }[];
}

interface ApiDate {
  year?: number;
  month?: number;
  day?: number;
}

interface MetricRow {
  startTime?: ApiDate;
  dimensions?: {
    dimension?: string;
    stringValue?: string;
    int64Value?: string;
  }[];
  metrics?: { metric?: string; decimalValue?: { value?: string } }[];
}

const STATUSES: ReleaseStatus[] = [
  "draft",
  "inProgress",
  "halted",
  "completed",
];

export function toRelease(r: ApiRelease): ReleaseData {
  return {
    name: r.name ?? null,
    versionCodes: (r.versionCodes ?? []).map(String),
    status: STATUSES.includes(r.status as ReleaseStatus)
      ? (r.status as ReleaseStatus)
      : "draft",
    userFraction: typeof r.userFraction === "number" ? r.userFraction : null,
    releaseNotes: (r.releaseNotes ?? [])
      .filter((n) => n.language)
      .map((n) => ({ language: n.language!, text: n.text ?? "" })),
  };
}

export function fromRelease(r: ReleaseData): ApiRelease {
  return {
    ...(r.name ? { name: r.name } : {}),
    versionCodes: r.versionCodes,
    status: r.status,
    ...(r.userFraction !== null && r.status !== "completed"
      ? { userFraction: r.userFraction }
      : {}),
    ...(r.releaseNotes.length ? { releaseNotes: r.releaseNotes } : {}),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d?: ApiDate) =>
  `${d?.year ?? 1970}-${pad(d?.month ?? 1)}-${pad(d?.day ?? 1)}`;

function laDate(offsetDays: number): ApiDate {
  const now = new Date(Date.now() - offsetDays * 86_400_000);
  const [m, d, y] = now
    .toLocaleDateString("en-US", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .map(Number);
  return { year: y, month: m, day: d };
}

export function toVitalsRows(
  rows: MetricRow[],
  rateMetric: string,
): VitalsRow[] {
  const out: VitalsRow[] = [];
  for (const row of rows) {
    const version = row.dimensions?.find((d) => d.dimension === "versionCode");
    const code = version?.stringValue ?? version?.int64Value;
    if (!code) continue;
    const metric = (name: string) => {
      const v = row.metrics?.find((m) => m.metric === name)?.decimalValue
        ?.value;
      return v === undefined ? null : Number(v);
    };
    out.push({
      day: dayOf(row.startTime),
      versionCode: code,
      rate: metric(rateMetric),
      users: metric("distinctUsers") ?? 0,
    });
  }
  return out;
}

const issueId = (name?: string) => name?.split("/").pop() ?? "";
const issueType = (t?: string): IssueType => (t === "ANR" ? "ANR" : "CRASH");

export class GooglePlayReleasesClient implements PlayReleasesApi {
  constructor(
    private readonly auth: TokenSource,
    private readonly http: Fetch = fetch,
  ) {}

  private async request<T>(
    key: PlayCredentials,
    packageName: string,
    url: string,
    scope: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.auth.token(key, scope);
    const res = await this.http(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    }).catch(() => {
      throw new PlayApiError(
        "unavailable",
        "Google Play couldn't be reached. Try again.",
      );
    });
    if (res.status === 204) return {} as T;
    const body = (await res.json().catch(() => ({}))) as T & {
      error?: { message?: string };
    };
    if (res.ok) return body;
    const detail = body.error?.message ?? `HTTP ${res.status}`;
    const reporting = scope === REPORTING_SCOPE;
    if (res.status === 401)
      throw new PlayApiError("auth", `Google rejected the key: ${detail}`);
    if (
      res.status === 403 &&
      reporting &&
      /has not been used|is disabled|SERVICE_DISABLED|not been enabled/i.test(
        detail,
      )
    )
      throw new PlayApiError(
        "disabled",
        `Turn on the Google Play Developer Reporting API for project ${key.projectId}: https://console.cloud.google.com/apis/library/playdeveloperreporting.googleapis.com?project=${encodeURIComponent(key.projectId)}`,
      );
    if (res.status === 403)
      throw new PlayApiError(
        "access",
        reporting
          ? `${key.clientEmail} can't read vitals for ${packageName}. In Play Console → Users and permissions, give it "View app quality information" for this app.`
          : `${key.clientEmail} can't manage releases for ${packageName}. In Play Console → Users and permissions, give it "Release to production, exclude devices, and use Play App Signing" and "Release apps to testing tracks" for this app.`,
      );
    if (res.status === 404)
      throw new PlayApiError(
        "not_found",
        `${packageName} isn't in this Play Console account.`,
      );
    if (res.status === 429)
      throw new PlayApiError(
        "quota",
        "Google Play's API limit was reached. Try again in a few minutes.",
      );
    if (res.status >= 500)
      throw new PlayApiError(
        "unavailable",
        `Google Play had a problem: ${detail}`,
      );
    throw new PlayApiError("invalid", detail);
  }

  private publisher<T>(
    key: PlayCredentials,
    packageName: string,
    path: string,
    init?: { method?: string; body?: unknown },
  ) {
    return this.request<T>(
      key,
      packageName,
      `${PUBLISHER}/${encodeURIComponent(packageName)}${path}`,
      PUBLISHER_SCOPE,
      init,
    );
  }

  private reporting<T>(
    key: PlayCredentials,
    packageName: string,
    path: string,
    init?: { method?: string; body?: unknown },
  ) {
    return this.request<T>(
      key,
      packageName,
      `${REPORTING}/${encodeURIComponent(packageName)}${path}`,
      REPORTING_SCOPE,
      init,
    );
  }

  private readonly editQueues = new Map<string, Promise<unknown>>();

  private withEdit<T>(
    key: PlayCredentials,
    packageName: string,
    fn: (editId: string) => Promise<T>,
    commit: boolean,
  ): Promise<T> {
    const previous = this.editQueues.get(packageName) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(() => this.openEdit(key, packageName, fn, commit));
    this.editQueues.set(packageName, run);
    void run
      .catch(() => undefined)
      .finally(() => {
        if (this.editQueues.get(packageName) === run)
          this.editQueues.delete(packageName);
      });
    return run;
  }

  private async openEdit<T>(
    key: PlayCredentials,
    packageName: string,
    fn: (editId: string) => Promise<T>,
    commit: boolean,
  ): Promise<T> {
    const edit = await this.publisher<{ id?: string }>(
      key,
      packageName,
      "/edits",
      { method: "POST", body: {} },
    );
    if (!edit.id)
      throw new PlayApiError("unavailable", "Google Play didn't open an edit.");
    let committed = false;
    try {
      const out = await fn(edit.id);
      if (commit) {
        await this.publisher(key, packageName, `/edits/${edit.id}:commit`, {
          method: "POST",
        });
        committed = true;
      }
      return out;
    } finally {
      if (!committed)
        await this.publisher(key, packageName, `/edits/${edit.id}`, {
          method: "DELETE",
        }).catch(() => undefined);
    }
  }

  listTracks(key: PlayCredentials, packageName: string) {
    return this.withEdit(
      key,
      packageName,
      async (editId) => {
        const res = await this.publisher<{
          tracks?: { track?: string; releases?: ApiRelease[] }[];
        }>(key, packageName, `/edits/${editId}/tracks`);
        return (res.tracks ?? [])
          .filter((t) => t.track)
          .map((t) => ({
            track: t.track!,
            releases: (t.releases ?? []).map(toRelease),
          }));
      },
      false,
    );
  }

  listingLanguages(key: PlayCredentials, packageName: string) {
    return this.withEdit(
      key,
      packageName,
      async (editId) => {
        const res = await this.publisher<{
          listings?: { language?: string }[];
        }>(key, packageName, `/edits/${editId}/listings`);
        return (res.listings ?? [])
          .map((l) => l.language)
          .filter((l): l is string => Boolean(l));
      },
      false,
    );
  }

  updateTrack(key: PlayCredentials, packageName: string, track: TrackData) {
    return this.withEdit(
      key,
      packageName,
      async (editId) => {
        const res = await this.publisher<{
          track?: string;
          releases?: ApiRelease[];
        }>(
          key,
          packageName,
          `/edits/${editId}/tracks/${encodeURIComponent(track.track)}`,
          {
            method: "PUT",
            body: {
              track: track.track,
              releases: track.releases.map(fromRelease),
            },
          },
        );
        return {
          track: res.track ?? track.track,
          releases: (res.releases ?? []).map(toRelease),
        };
      },
      true,
    );
  }

  async vitals(
    key: PlayCredentials,
    packageName: string,
    metric: "crash" | "anr",
    days: number,
  ): Promise<VitalsRow[]> {
    const set = metric === "crash" ? "crashRateMetricSet" : "anrRateMetricSet";
    const rate =
      metric === "crash" ? "userPerceivedCrashRate" : "userPerceivedAnrRate";
    const meta = await this.reporting<{
      freshnessInfo?: {
        freshnesses?: {
          aggregationPeriod?: string;
          latestEndTime?: ApiDate & { hours?: number };
        }[];
      };
    }>(key, packageName, `/${set}`);
    const end =
      meta.freshnessInfo?.freshnesses?.find(
        (f) => f.aggregationPeriod === "DAILY",
      )?.latestEndTime ?? laDate(1);
    const endDate = new Date(
      Date.UTC(end.year ?? 1970, (end.month ?? 1) - 1, end.day ?? 1),
    );
    const start = new Date(endDate.getTime() - days * 86_400_000);
    const rows: MetricRow[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await this.reporting<{
        rows?: MetricRow[];
        nextPageToken?: string;
      }>(key, packageName, `/${set}:query`, {
        method: "POST",
        body: {
          timelineSpec: {
            aggregationPeriod: "DAILY",
            startTime: {
              year: start.getUTCFullYear(),
              month: start.getUTCMonth() + 1,
              day: start.getUTCDate(),
              timeZone: { id: ZONE },
            },
            endTime: {
              year: end.year,
              month: end.month,
              day: end.day,
              timeZone: { id: ZONE },
            },
          },
          dimensions: ["versionCode"],
          metrics: [rate, "distinctUsers"],
          pageSize: 10000,
          ...(page ? { pageToken: page } : {}),
        },
      });
      rows.push(...(res.rows ?? []));
      page = res.nextPageToken;
      if (!page) break;
    }
    return toVitalsRows(rows, rate);
  }

  private interval() {
    const start = laDate(30);
    const end = laDate(0);
    const query = new URLSearchParams();
    for (const [name, d] of [
      ["startTime", start],
      ["endTime", end],
    ] as const) {
      query.set(`interval.${name}.year`, String(d.year));
      query.set(`interval.${name}.month`, String(d.month));
      query.set(`interval.${name}.day`, String(d.day));
      query.set(`interval.${name}.timeZone.id`, ZONE);
    }
    return query;
  }

  async errorIssues(
    key: PlayCredentials,
    packageName: string,
    type: IssueType | null,
  ): Promise<ErrorIssueData[]> {
    const query = this.interval();
    query.set("pageSize", "50");
    query.set("orderBy", "distinctUsers desc");
    query.set(
      "filter",
      type
        ? `errorIssueType = ${type}`
        : "errorIssueType = CRASH OR errorIssueType = ANR",
    );
    const res = await this.reporting<{
      errorIssues?: {
        name?: string;
        type?: string;
        cause?: string;
        location?: string;
        errorReportCount?: string;
        distinctUsers?: string;
        firstAppVersion?: { versionCode?: string };
        lastAppVersion?: { versionCode?: string };
        issueUri?: string;
      }[];
    }>(key, packageName, `/errorIssues:search?${query.toString()}`);
    return (res.errorIssues ?? []).map((i) => ({
      id: issueId(i.name),
      type: issueType(i.type),
      cause: i.cause ?? "Unknown error",
      location: i.location ?? "",
      reports: Number(i.errorReportCount ?? 0),
      users: Number(i.distinctUsers ?? 0),
      firstVersionCode: i.firstAppVersion?.versionCode ?? null,
      lastVersionCode: i.lastAppVersion?.versionCode ?? null,
      issueUri: i.issueUri ?? null,
    }));
  }

  async errorReports(
    key: PlayCredentials,
    packageName: string,
    id: string,
  ): Promise<ErrorReportData[]> {
    const query = this.interval();
    query.set("pageSize", "20");
    query.set("filter", `errorIssueId = ${id}`);
    const res = await this.reporting<{
      errorReports?: {
        name?: string;
        type?: string;
        reportText?: string;
        eventTime?: string;
        deviceModel?: {
          marketingName?: string;
          deviceId?: { buildBrand?: string; buildDevice?: string };
        };
        osVersion?: { apiLevel?: string };
        appVersion?: { versionCode?: string };
      }[];
    }>(key, packageName, `/errorReports:search?${query.toString()}`);
    return (res.errorReports ?? []).map((r) => ({
      id: issueId(r.name),
      type: issueType(r.type),
      reportText: r.reportText ?? "",
      eventTime: r.eventTime ?? new Date(0).toISOString(),
      device:
        r.deviceModel?.marketingName ??
        ([
          r.deviceModel?.deviceId?.buildBrand,
          r.deviceModel?.deviceId?.buildDevice,
        ]
          .filter(Boolean)
          .join(" ") ||
          null),
      androidVersion: r.osVersion?.apiLevel
        ? Number(r.osVersion.apiLevel)
        : null,
      versionCode: r.appVersion?.versionCode ?? null,
    }));
  }
}
