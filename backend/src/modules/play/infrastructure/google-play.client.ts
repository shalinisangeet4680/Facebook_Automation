import { Injectable } from "@nestjs/common";
import { createSign } from "crypto";

import {
  PlayApi,
  PlayApiError,
  PlayReviewData,
  ServiceAccountKey,
} from "../domain/ports/play-api";

const API =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const MAX_PAGES = 20;

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

  private async token(key: ServiceAccountKey): Promise<string> {
    const cached = this.tokens.get(key.clientEmail);
    if (cached && cached.expires > Date.now() + 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
      JSON.stringify({
        iss: key.clientEmail,
        scope: SCOPE,
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
    this.tokens.set(key.clientEmail, {
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
      this.tokens.delete(key.clientEmail);
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
        "Google Play's review limit was reached. Autopilot will try again later.",
      );
    if (res.status >= 500)
      throw new PlayApiError(
        "unavailable",
        `Google Play had a problem: ${detail}`,
      );
    throw new PlayApiError("invalid", detail);
  }

  async verifyKey(key: ServiceAccountKey): Promise<void> {
    this.tokens.delete(key.clientEmail);
    await this.token(key);
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
      const details = await this.call<{ defaultLanguage?: string }>(
        key,
        packageName,
        `/edits/${editId}/details`,
      );
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
