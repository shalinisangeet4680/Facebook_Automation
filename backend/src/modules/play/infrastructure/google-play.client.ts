import { Injectable } from "@nestjs/common";
import { createSign } from "crypto";

import {
  DiscoveredApp,
  PlayApi,
  PlayApiError,
  PlayReviewData,
  ReportFile,
  ServiceAccountKey,
} from "../domain/ports/play-api";

const API =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const REPORTING_SCOPE =
  "https://www.googleapis.com/auth/playdeveloperreporting";
const REPORTING = "https://playdeveloperreporting.googleapis.com/v1beta1";
const MAX_PAGES = 20;
const STORAGE_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";
const STORAGE = "https://storage.googleapis.com/storage/v1/b";

type Fetch = typeof fetch;

interface Timestamp {
  seconds?: string;
  nanos?: number;
}

interface UserComment {
  text?: string;
  originalText?: string;
  lastModified?: Timestamp;
  starRating?: number;
  reviewerLanguage?: string;
  device?: string;
  androidOsVersion?: number;
  appVersionCode?: number;
  appVersionName?: string;
  thumbsUpCount?: number;
  deviceMetadata?: { productName?: string; manufacturer?: string };
}

interface ApiReview {
  reviewId: string;
  authorName?: string;
  comments?: {
    userComment?: UserComment;
    developerComment?: { text?: string; lastModified?: Timestamp };
  }[];
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

const toDate = (t?: Timestamp) =>
  new Date(Number(t?.seconds ?? 0) * 1000 + Math.floor((t?.nanos ?? 0) / 1e6));

export function toReview(review: ApiReview): PlayReviewData | null {
  const user = review.comments?.find((c) => c.userComment)?.userComment;
  if (!user?.starRating) return null;
  const dev = review.comments?.find(
    (c) => c.developerComment,
  )?.developerComment;
  const text = (user.text ?? "").trim();
  const original = user.originalText?.trim();
  const device = [
    user.deviceMetadata?.manufacturer,
    user.deviceMetadata?.productName,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    reviewId: review.reviewId,
    authorName: (review.authorName ?? "").trim(),
    stars: user.starRating,
    text,
    originalText: original && original !== text ? original : null,
    language: user.reviewerLanguage ?? null,
    lastModified: toDate(user.lastModified),
    appVersionName: user.appVersionName ?? null,
    appVersionCode: user.appVersionCode ?? null,
    device: device || user.device || null,
    androidVersion: user.androidOsVersion ?? null,
    thumbsUp: user.thumbsUpCount ?? 0,
    reply: dev?.text
      ? { text: dev.text.trim(), lastModified: toDate(dev.lastModified) }
      : null,
  };
}

@Injectable()
export class GooglePlayClient implements PlayApi {
  private readonly tokens = new Map<
    string,
    { token: string; expires: number }
  >();

  constructor(private readonly http: Fetch = fetch) {}

  async token(key: ServiceAccountKey, scope = SCOPE): Promise<string> {
    const cacheKey = `${key.clientEmail} ${scope}`;
    const cached = this.tokens.get(cacheKey);
    if (cached && cached.expires > Date.now() + 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
      JSON.stringify({
        iss: key.clientEmail,
        scope,
        aud: key.tokenUri,
        iat: now,
        exp: now + 3600,
      }),
    )}`;
    let signature: string;
    try {
      signature = createSign("RSA-SHA256")
        .update(unsigned)
        .sign(key.privateKey, "base64url");
    } catch {
      throw new PlayApiError(
        "auth",
        "The private key in this file can't be read. Download a new JSON key.",
      );
    }
    const res = await this.http(key.tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }),
    }).catch(() => {
      throw new PlayApiError(
        "unavailable",
        "Google couldn't be reached. Try again.",
      );
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok || !body.access_token)
      throw new PlayApiError(
        "auth",
        `Google rejected this key${body.error_description ? `: ${body.error_description}` : ""}. It may have been deleted; create a new key.`,
      );
    this.tokens.set(cacheKey, {
      token: body.access_token,
      expires: Date.now() + (body.expires_in ?? 3600) * 1000,
    });
    return body.access_token;
  }

  private async call<T>(
    key: ServiceAccountKey,
    packageName: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.token(key);
    const res = await this.http(
      `${API}/${encodeURIComponent(packageName)}${path}`,
      {
        method: init.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      },
    ).catch(() => {
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
    if (res.status === 401) {
      this.tokens.delete(`${key.clientEmail} ${SCOPE}`);
      throw new PlayApiError("auth", `Google rejected the key: ${detail}`);
    }
    if (res.status === 403)
      throw new PlayApiError(
        "access",
        `${key.clientEmail} can't access ${packageName}. In Play Console, open Users and permissions, invite this email and give it "Reply to reviews" for this app.`,
      );
    if (res.status === 404)
      throw new PlayApiError(
        "not_found",
        `${packageName} isn't in this Play Console account, or it has no production release yet.`,
      );
    if (res.status === 429)
      throw new PlayApiError(
        "quota",
        "Google Play's review limit was reached. TreeVook will try again later.",
      );
    if (res.status >= 500)
      throw new PlayApiError(
        "unavailable",
        `Google Play had a problem: ${detail}`,
      );
    throw new PlayApiError("invalid", detail);
  }

  private async storage(key: ServiceAccountKey, bucket: string, url: string) {
    const token = await this.token(key, STORAGE_SCOPE);
    const res = await this.http(url, {
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => {
      throw new PlayApiError(
        "unavailable",
        "Google Cloud Storage couldn't be reached. Try again.",
      );
    });
    if (res.ok) return res;
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    const detail = body.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403)
      throw new PlayApiError(
        "access",
        `${key.clientEmail} can't read the reports in gs://${bucket}. In Play Console → Users and permissions, open this service account and turn on "View app information and download bulk reports" under Account permissions. It can take up to a day to apply.`,
      );
    if (res.status === 404)
      throw new PlayApiError(
        "not_found",
        `gs://${bucket} doesn't exist. Copy the Cloud Storage URI from Play Console → Download reports → Reviews.`,
      );
    if (res.status === 429)
      throw new PlayApiError(
        "quota",
        "Cloud Storage is rate limited. Try again later.",
      );
    throw new PlayApiError(
      res.status >= 500 ? "unavailable" : "invalid",
      detail,
    );
  }

  async listReports(
    key: ServiceAccountKey,
    bucket: string,
    prefix: string,
  ): Promise<ReportFile[]> {
    const files: ReportFile[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const query = new URLSearchParams({
        prefix,
        maxResults: "1000",
        fields: "items(name,updated,size),nextPageToken",
      });
      if (page) query.set("pageToken", page);
      const res = await this.storage(
        key,
        bucket,
        `${STORAGE}/${encodeURIComponent(bucket)}/o?${query.toString()}`,
      );
      const body = (await res.json()) as {
        items?: { name: string; updated: string; size: string }[];
        nextPageToken?: string;
      };
      for (const item of body.items ?? [])
        files.push({
          name: item.name,
          updated: item.updated,
          size: Number(item.size),
        });
      page = body.nextPageToken;
      if (!page) break;
    }
    return files;
  }

  async downloadReport(
    key: ServiceAccountKey,
    bucket: string,
    name: string,
  ): Promise<Buffer> {
    const res = await this.storage(
      key,
      bucket,
      `${STORAGE}/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`,
    );
    return Buffer.from(await res.arrayBuffer());
  }

  async verifyKey(key: ServiceAccountKey): Promise<void> {
    this.tokens.delete(`${key.clientEmail} ${SCOPE}`);
    await this.token(key);
  }

  async listApps(key: ServiceAccountKey): Promise<DiscoveredApp[]> {
    const token = await this.token(key, REPORTING_SCOPE);
    const apps: DiscoveredApp[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const query = new URLSearchParams({ pageSize: "1000" });
      if (page) query.set("pageToken", page);
      const res = await this.http(
        `${REPORTING}/apps:search?${query.toString()}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      ).catch(() => {
        throw new PlayApiError(
          "unavailable",
          "Google Play couldn't be reached. Try again.",
        );
      });
      const body = (await res.json().catch(() => ({}))) as {
        apps?: { packageName?: string; displayName?: string }[];
        nextPageToken?: string;
        error?: { message?: string; status?: string };
      };
      if (!res.ok) {
        const message = body.error?.message ?? `HTTP ${res.status}`;
        if (
          res.status === 403 &&
          /has not been used|is disabled|SERVICE_DISABLED|not been enabled/i.test(
            message,
          )
        )
          throw new PlayApiError(
            "disabled",
            `Turn on the Google Play Developer Reporting API for project ${key.projectId} so your apps can be found automatically: https://console.cloud.google.com/apis/library/playdeveloperreporting.googleapis.com?project=${encodeURIComponent(key.projectId)}`,
          );
        if (res.status === 401 || res.status === 403)
          throw new PlayApiError(
            "access",
            `${key.clientEmail} can't list apps. In Play Console, give it "View app information" for your apps.`,
          );
        throw new PlayApiError(
          res.status >= 500 ? "unavailable" : "invalid",
          message,
        );
      }
      for (const app of body.apps ?? [])
        if (app.packageName)
          apps.push({
            packageName: app.packageName,
            displayName: app.displayName ?? null,
          });
      page = body.nextPageToken;
      if (!page) break;
    }
    return apps;
  }

  async listReviews(
    key: ServiceAccountKey,
    packageName: string,
    options: { translationLanguage?: string },
  ): Promise<PlayReviewData[]> {
    const reviews: PlayReviewData[] = [];
    let page: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const query = new URLSearchParams({ maxResults: "100" });
      if (options.translationLanguage)
        query.set("translationLanguage", options.translationLanguage);
      if (page) query.set("token", page);
      const res = await this.call<{
        reviews?: ApiReview[];
        tokenPagination?: { nextPageToken?: string };
      }>(key, packageName, `/reviews?${query.toString()}`);
      for (const r of res.reviews ?? []) {
        const review = toReview(r);
        if (review) reviews.push(review);
      }
      page = res.tokenPagination?.nextPageToken;
      if (!page) break;
    }
    return reviews;
  }

  async reply(
    key: ServiceAccountKey,
    packageName: string,
    reviewId: string,
    text: string,
  ) {
    const res = await this.call<{
      result?: { replyText?: string; lastEdited?: Timestamp };
    }>(key, packageName, `/reviews/${encodeURIComponent(reviewId)}:reply`, {
      method: "POST",
      body: { replyText: text },
    });
    return {
      text: res.result?.replyText ?? text,
      lastModified: res.result?.lastEdited
        ? toDate(res.result.lastEdited)
        : new Date(),
    };
  }

  async listing(key: ServiceAccountKey, packageName: string) {
    let editId: string | undefined;
    try {
      const edit = await this.call<{ id?: string }>(
        key,
        packageName,
        "/edits",
        {
          method: "POST",
          body: {},
        },
      );
      editId = edit.id;
      if (!editId) return { title: null, iconUrl: null };
      const details = await this.call<{
        defaultLanguage?: string;
        contactEmail?: string;
        contactPhone?: string;
        contactWebsite?: string;
      }>(key, packageName, `/edits/${editId}/details`);
      const lang = details.defaultLanguage ?? "en-US";
      const [listing, icons] = await Promise.all([
        this.call<{ title?: string }>(
          key,
          packageName,
          `/edits/${editId}/listings/${lang}`,
        ),
        this.call<{ images?: { url?: string }[] }>(
          key,
          packageName,
          `/edits/${editId}/listings/${lang}/icon`,
        ).catch(() => ({ images: [] })),
      ]);
      return {
        title: listing.title ?? null,
        iconUrl: icons.images?.[0]?.url ?? null,
        contactEmail: details.contactEmail ?? null,
        contactPhone: details.contactPhone ?? null,
        contactWebsite: details.contactWebsite ?? null,
      };
    } catch {
      return { title: null, iconUrl: null };
    } finally {
      if (editId)
        await this.call(key, packageName, `/edits/${editId}`, {
          method: "DELETE",
        }).catch(() => undefined);
    }
  }
}
