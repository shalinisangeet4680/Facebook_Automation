import { createHash } from "node:crypto";

import {
  BusinessInfo,
  InfoPatch,
  OpeningPeriod,
  PostContent,
  WEEKDAYS,
  Weekday,
  emptyMetrics,
} from "../domain/business.types";
import {
  BusinessApi,
  BusinessApiError,
  GBP_SCOPES,
  GbpAccount,
  GbpDailyMetric,
  GbpLocation,
  GbpPost,
  GbpReview,
  GbpReviewPage,
  GoogleGrant,
} from "../domain/ports/business-api";

const OAUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const PERFORMANCE = "https://businessprofileperformance.googleapis.com/v1";

const READ_MASK =
  "name,title,storefrontAddress,phoneNumbers,websiteUri,categories,regularHours,profile,metadata";

const STARS: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

const METRIC_MAP = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "impressionsMaps",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "impressionsMaps",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "impressionsSearch",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "impressionsSearch",
  CALL_CLICKS: "calls",
  WEBSITE_CLICKS: "websiteClicks",
  BUSINESS_DIRECTION_REQUESTS: "directions",
  BUSINESS_CONVERSATIONS: "conversations",
  BUSINESS_BOOKINGS: "bookings",
} as const;

interface GoogleTime {
  hours?: number;
  minutes?: number;
}

interface GooglePeriod {
  openDay: Weekday;
  closeDay: Weekday;
  openTime?: GoogleTime;
  closeTime?: GoogleTime;
}

interface GoogleLocation {
  name: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  categories?: {
    primaryCategory?: { displayName?: string };
    additionalCategories?: { displayName?: string }[];
  };
  regularHours?: { periods?: GooglePeriod[] };
  profile?: { description?: string };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
    newReviewUri?: string;
    hasVoiceOfMerchant?: boolean;
  };
}

interface GoogleReview {
  name: string;
  reviewId: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

const pad = (n: number) => String(n).padStart(2, "0");
const time = (t?: GoogleTime) =>
  `${pad(t?.hours ?? 0)}:${pad(t?.minutes ?? 0)}`;
const toTime = (hhmm: string): GoogleTime => {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m };
};

function periods(raw?: GooglePeriod[]): OpeningPeriod[] {
  return (raw ?? []).map((p) => ({
    day: p.openDay,
    open: time(p.openTime),
    close:
      p.closeDay !== p.openDay && time(p.closeTime) === "00:00"
        ? "24:00"
        : time(p.closeTime),
  }));
}

function toPeriods(hours: OpeningPeriod[]): GooglePeriod[] {
  return hours.map((h) => {
    const next = WEEKDAYS[(WEEKDAYS.indexOf(h.day) + 1) % 7]!;
    return {
      openDay: h.day,
      openTime: toTime(h.open),
      closeDay: h.close === "24:00" ? next : h.day,
      closeTime:
        h.close === "24:00" ? { hours: 0, minutes: 0 } : toTime(h.close),
    };
  });
}

export function toLocation(l: GoogleLocation): GbpLocation {
  const a = l.storefrontAddress;
  const info: BusinessInfo = {
    title: l.title ?? "",
    description: l.profile?.description ?? "",
    phone: l.phoneNumbers?.primaryPhone ?? null,
    website: l.websiteUri ?? null,
    address: a
      ? {
          lines: a.addressLines ?? [],
          locality: a.locality ?? "",
          region: a.administrativeArea ?? "",
          postalCode: a.postalCode ?? "",
          country: a.regionCode ?? "",
        }
      : null,
    primaryCategory: l.categories?.primaryCategory?.displayName ?? null,
    additionalCategories: (l.categories?.additionalCategories ?? [])
      .map((c) => c.displayName ?? "")
      .filter(Boolean),
    hours: periods(l.regularHours?.periods),
  };
  return {
    name: l.name,
    info,
    placeId: l.metadata?.placeId ?? null,
    mapsUri: l.metadata?.mapsUri ?? null,
    newReviewUri: l.metadata?.newReviewUri ?? null,
    verified: l.metadata?.hasVoiceOfMerchant ?? true,
  };
}

export function toReview(r: GoogleReview): GbpReview {
  return {
    name: r.name,
    reviewId: r.reviewId,
    reviewer: r.reviewer?.displayName ?? "",
    reviewerPhoto: r.reviewer?.profilePhotoUrl ?? null,
    stars: STARS[r.starRating ?? ""] ?? 0,
    comment: (r.comment ?? "").replace(
      /\s*\(Translated by Google\)[\s\S]*$/,
      "",
    ),
    createTime: new Date(r.createTime),
    updateTime: new Date(r.updateTime),
    reply: r.reviewReply
      ? {
          comment: r.reviewReply.comment,
          updateTime: new Date(r.reviewReply.updateTime),
        }
      : null,
  };
}

const dateParts = (iso: string) => {
  const d = new Date(iso);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
};

const timeParts = (iso: string) => {
  const d = new Date(iso);
  return { hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
};

export function toLocalPost(post: PostContent) {
  return {
    languageCode: "en",
    summary: post.summary,
    topicType: post.type,
    ...(post.cta
      ? {
          callToAction: {
            actionType: post.cta.type,
            ...(post.cta.url ? { url: post.cta.url } : {}),
          },
        }
      : {}),
    ...(post.mediaUrl
      ? { media: [{ mediaFormat: "PHOTO", sourceUrl: post.mediaUrl }] }
      : {}),
    ...(post.event
      ? {
          event: {
            title: post.event.title,
            schedule: {
              startDate: dateParts(post.event.start),
              startTime: timeParts(post.event.start),
              endDate: dateParts(post.event.end),
              endTime: timeParts(post.event.end),
            },
          },
        }
      : {}),
    ...(post.type === "OFFER" && post.offer
      ? {
          offer: {
            ...(post.offer.couponCode
              ? { couponCode: post.offer.couponCode }
              : {}),
            ...(post.offer.redeemUrl
              ? { redeemOnlineUrl: post.offer.redeemUrl }
              : {}),
            ...(post.offer.terms ? { termsConditions: post.offer.terms } : {}),
          },
        }
      : {}),
  };
}

function errorFor(status: number, body: string): BusinessApiError {
  let message = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string } | string;
      error_description?: string;
    };
    message =
      typeof parsed.error === "string"
        ? (parsed.error_description ?? parsed.error)
        : (parsed.error?.message ?? message);
  } catch {
    message = message || `Google returned ${status}`;
  }
  if (status === 400 && /invalid_grant/.test(body))
    return new BusinessApiError(
      "auth",
      "Google sign-in expired or was revoked. Connect your Google account again.",
    );
  if (status === 401)
    return new BusinessApiError(
      "auth",
      "Google sign-in expired. Connect your Google account again.",
    );
  if (status === 403)
    return new BusinessApiError(
      "access",
      /has not been used|is disabled|SERVICE_DISABLED/i.test(body)
        ? "The Google Business Profile APIs aren't enabled for this project yet. Request access from Google, then enable them."
        : /quota/i.test(body)
          ? "Google Business Profile API access hasn't been approved yet (quota is 0). Request access from Google."
          : "This Google account can't manage this business. Make it an owner or manager in Business Profile.",
    );
  if (status === 404)
    return new BusinessApiError(
      "not_found",
      "Google couldn't find this business or review anymore.",
    );
  if (status === 429)
    return new BusinessApiError(
      "quota",
      "Google's rate limit was reached. TreeVook will try again shortly.",
    );
  if (status === 400) return new BusinessApiError("invalid", message);
  return new BusinessApiError("error", `Google returned an error: ${message}`);
}

export class GoogleBusinessClient implements BusinessApi {
  private readonly tokens = new Map<string, { token: string; until: number }>();

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  authUrl(redirectUri: string, state: string): string {
    const url = new URL(OAUTH);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GBP_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleGrant> {
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const body = await res.text();
    if (!res.ok) throw errorFor(res.status, body);
    const data = JSON.parse(body) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    if (!data.refresh_token)
      throw new BusinessApiError(
        "auth",
        "Google didn't return offline access. Remove TreeVook from your Google account's third-party access, then connect again.",
      );
    if (!data.scope?.includes("business.manage"))
      throw new BusinessApiError(
        "access",
        "Allow TreeVook to manage your Business Profile on Google's consent screen.",
      );
    const info = await fetch(USERINFO, {
      headers: { authorization: `Bearer ${data.access_token}` },
    });
    const user = (await info.json()) as { email?: string };
    this.remember(data.refresh_token, data.access_token, data.expires_in);
    return { refreshToken: data.refresh_token, email: user.email ?? "unknown" };
  }

  private key(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  private remember(refreshToken: string, token: string, expiresIn: number) {
    this.tokens.set(this.key(refreshToken), {
      token,
      until: Date.now() + (expiresIn - 120) * 1000,
    });
  }

  private async accessToken(refreshToken: string): Promise<string> {
    const cached = this.tokens.get(this.key(refreshToken));
    if (cached && cached.until > Date.now()) return cached.token;
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    });
    const body = await res.text();
    if (!res.ok) throw errorFor(res.status, body);
    const data = JSON.parse(body) as {
      access_token: string;
      expires_in: number;
    };
    this.remember(refreshToken, data.access_token, data.expires_in);
    return data.access_token;
  }

  private async call<T>(
    refreshToken: string,
    url: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.accessToken(refreshToken);
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const body = await res.text();
    if (!res.ok) throw errorFor(res.status, body);
    return (body ? JSON.parse(body) : {}) as T;
  }

  async accounts(refreshToken: string): Promise<GbpAccount[]> {
    const out: GbpAccount[] = [];
    let pageToken = "";
    do {
      const data = await this.call<{
        accounts?: { name: string; accountName?: string; type?: string }[];
        nextPageToken?: string;
      }>(
        refreshToken,
        `${ACCOUNTS}/accounts?pageSize=20${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      for (const a of data.accounts ?? [])
        out.push({
          name: a.name,
          accountName: a.accountName ?? a.name,
          type: a.type ?? "PERSONAL",
        });
      pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    return out;
  }

  async locations(
    refreshToken: string,
    account: string,
  ): Promise<GbpLocation[]> {
    const out: GbpLocation[] = [];
    let pageToken = "";
    do {
      const data = await this.call<{
        locations?: GoogleLocation[];
        nextPageToken?: string;
      }>(
        refreshToken,
        `${INFO}/${account}/locations?pageSize=100&readMask=${READ_MASK}${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      for (const l of data.locations ?? []) out.push(toLocation(l));
      pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    return out;
  }

  async location(refreshToken: string, location: string): Promise<GbpLocation> {
    return toLocation(
      await this.call<GoogleLocation>(
        refreshToken,
        `${INFO}/${location}?readMask=${READ_MASK}`,
      ),
    );
  }

  async updateLocation(
    refreshToken: string,
    location: string,
    patch: InfoPatch,
  ): Promise<GbpLocation> {
    const mask: string[] = [];
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      mask.push("title");
      body.title = patch.title;
    }
    if (patch.description !== undefined) {
      mask.push("profile.description");
      body.profile = { description: patch.description };
    }
    if (patch.phone !== undefined) {
      mask.push("phoneNumbers.primaryPhone");
      body.phoneNumbers = { primaryPhone: patch.phone ?? "" };
    }
    if (patch.website !== undefined) {
      mask.push("websiteUri");
      body.websiteUri = patch.website ?? "";
    }
    if (patch.hours !== undefined) {
      mask.push("regularHours");
      body.regularHours = { periods: toPeriods(patch.hours) };
    }
    await this.call(
      refreshToken,
      `${INFO}/${location}?updateMask=${mask.join(",")}`,
      { method: "PATCH", body },
    );
    return this.location(refreshToken, location);
  }

  async reviews(
    refreshToken: string,
    account: string,
    location: string,
  ): Promise<GbpReviewPage> {
    const reviews: GbpReview[] = [];
    let averageRating: number | null = null;
    let totalReviewCount = 0;
    let pageToken = "";
    let pages = 0;
    do {
      const data = await this.call<{
        reviews?: GoogleReview[];
        averageRating?: number;
        totalReviewCount?: number;
        nextPageToken?: string;
      }>(
        refreshToken,
        `${V4}/${account}/${location}/reviews?pageSize=50&orderBy=updateTime%20desc${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      for (const r of data.reviews ?? []) reviews.push(toReview(r));
      averageRating = data.averageRating ?? averageRating;
      totalReviewCount = data.totalReviewCount ?? totalReviewCount;
      pageToken = data.nextPageToken ?? "";
      pages++;
    } while (pageToken && pages < 40);
    return { reviews, averageRating, totalReviewCount };
  }

  async reply(refreshToken: string, reviewName: string, text: string) {
    await this.call(refreshToken, `${V4}/${reviewName}/reply`, {
      method: "PUT",
      body: { comment: text },
    });
  }

  async deleteReply(refreshToken: string, reviewName: string) {
    await this.call(refreshToken, `${V4}/${reviewName}/reply`, {
      method: "DELETE",
    });
  }

  async createPost(
    refreshToken: string,
    account: string,
    location: string,
    post: PostContent,
  ): Promise<GbpPost> {
    const data = await this.call<{
      name: string;
      searchUrl?: string;
      state?: string;
    }>(refreshToken, `${V4}/${account}/${location}/localPosts`, {
      method: "POST",
      body: toLocalPost(post),
    });
    return {
      name: data.name,
      searchUrl: data.searchUrl ?? null,
      state: data.state ?? "LIVE",
    };
  }

  async deletePost(refreshToken: string, postName: string) {
    await this.call(refreshToken, `${V4}/${postName}`, { method: "DELETE" });
  }

  async metrics(
    refreshToken: string,
    location: string,
    from: string,
    to: string,
  ): Promise<GbpDailyMetric[]> {
    const url = new URL(
      `${PERFORMANCE}/${location}:fetchMultiDailyMetricsTimeSeries`,
    );
    for (const m of Object.keys(METRIC_MAP))
      url.searchParams.append("dailyMetrics", m);
    const [fy, fm, fd] = from.split("-");
    const [ty, tm, td] = to.split("-");
    url.searchParams.set("dailyRange.start_date.year", String(Number(fy)));
    url.searchParams.set("dailyRange.start_date.month", String(Number(fm)));
    url.searchParams.set("dailyRange.start_date.day", String(Number(fd)));
    url.searchParams.set("dailyRange.end_date.year", String(Number(ty)));
    url.searchParams.set("dailyRange.end_date.month", String(Number(tm)));
    url.searchParams.set("dailyRange.end_date.day", String(Number(td)));
    const data = await this.call<{
      multiDailyMetricTimeSeries?: {
        dailyMetricTimeSeries?: {
          dailyMetric: keyof typeof METRIC_MAP;
          timeSeries?: {
            datedValues?: {
              date: { year: number; month: number; day: number };
              value?: string;
            }[];
          };
        }[];
      }[];
    }>(refreshToken, url.toString());
    const days = new Map<string, GbpDailyMetric>();
    for (const group of data.multiDailyMetricTimeSeries ?? [])
      for (const series of group.dailyMetricTimeSeries ?? []) {
        const key = METRIC_MAP[series.dailyMetric];
        if (!key) continue;
        for (const v of series.timeSeries?.datedValues ?? []) {
          const day = `${v.date.year}-${pad(v.date.month)}-${pad(v.date.day)}`;
          const row = days.get(day) ?? { day, ...emptyMetrics() };
          row[key] += Number(v.value ?? 0);
          days.set(day, row);
        }
      }
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  }
}
