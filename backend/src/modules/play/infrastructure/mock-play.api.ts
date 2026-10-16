import {
  DiscoveredApp,
  PlayApi,
  PlayApiError,
  PlayReviewData,
  ReportFile,
  ServiceAccountKey,
} from "../domain/ports/play-api";

const HOUR = 3_600_000;

const SEED: Omit<PlayReviewData, "lastModified" | "reply">[] = [
  {
    reviewId: "gp-1",
    authorName: "Priya Sharma",
    stars: 5,
    text: "Love this app, makes my day easier!",
    originalText: null,
    language: "en",
    appVersionName: "2.3.1",
    appVersionCode: 231,
    device: "Samsung Galaxy A05",
    androidVersion: 34,
    thumbsUp: 4,
  },
  {
    reviewId: "gp-2",
    authorName: "Rahul Verma",
    stars: 1,
    text: "App keeps crashing when I open my orders.",
    originalText: null,
    language: "en",
    appVersionName: "2.3.1",
    appVersionCode: 231,
    device: "Redmi Note 12",
    androidVersion: 33,
    thumbsUp: 9,
  },
  {
    reviewId: "gp-3",
    authorName: "A Google user",
    stars: 2,
    text: "Money was deducted but the order failed. Need a refund.",
    originalText: null,
    language: "en",
    appVersionName: "2.3.0",
    appVersionCode: 230,
    device: "Vivo Y21",
    androidVersion: 31,
    thumbsUp: 2,
  },
  {
    reviewId: "gp-4",
    authorName: "Anjali Gupta",
    stars: 4,
    text: "Very useful. Please add dark mode.",
    originalText: null,
    language: "en",
    appVersionName: "2.3.1",
    appVersionCode: 231,
    device: "OnePlus Nord",
    androidVersion: 34,
    thumbsUp: 1,
  },
  {
    reviewId: "gp-5",
    authorName: "Suresh Kumar",
    stars: 5,
    text: "Very good app, very helpful",
    originalText: "बहुत अच्छा ऐप, बहुत मददगार",
    language: "hi",
    appVersionName: "2.3.1",
    appVersionCode: 231,
    device: "Realme C55",
    androidVersion: 33,
    thumbsUp: 0,
  },
  {
    reviewId: "gp-6",
    authorName: "Neha Singh",
    stars: 3,
    text: "It's okay, a bit slow sometimes.",
    originalText: null,
    language: "en",
    appVersionName: "2.2.9",
    appVersionCode: 229,
    device: "Samsung Galaxy M14",
    androidVersion: 33,
    thumbsUp: 0,
  },
  {
    reviewId: "gp-7",
    authorName: "Vikram Rao",
    stars: 1,
    text: "Total scam, they took my money.",
    originalText: null,
    language: "en",
    appVersionName: "2.3.1",
    appVersionCode: 231,
    device: "Poco X5",
    androidVersion: 34,
    thumbsUp: 12,
  },
  {
    reviewId: "gp-8",
    authorName: "Lucas Silva",
    stars: 5,
    text: "Great app",
    originalText: "Ótimo aplicativo",
    language: "pt",
    appVersionName: "2.3.1",
    appVersionCode: 231,
    device: "Moto G54",
    androidVersion: 34,
    thumbsUp: 0,
  },
];

interface Stored {
  review: Omit<PlayReviewData, "reply">;
  reply: PlayReviewData["reply"];
}

const store = new Map<string, Map<string, Stored>>();

function appStore(packageName: string): Map<string, Stored> {
  let reviews = store.get(packageName);
  if (!reviews) {
    const now = Date.now();
    reviews = new Map(
      SEED.map((r, i) => [
        r.reviewId,
        {
          review: { ...r, lastModified: new Date(now - (i + 1) * 3 * HOUR) },
          reply: null,
        },
      ]),
    );
    store.set(packageName, reviews);
  }
  return reviews;
}

const extraApps: DiscoveredApp[] = [];

export function resetMockPlay(): void {
  store.clear();
  extraApps.length = 0;
}

export function addMockApp(app: DiscoveredApp): void {
  extraApps.push(app);
}

export function addMockReview(
  packageName: string,
  review: Partial<PlayReviewData> & { reviewId: string },
): void {
  const reviews = appStore(packageName);
  const current = reviews.get(review.reviewId);
  const base = current?.review ?? {
    ...SEED[0]!,
    authorName: "New Reviewer",
    text: "",
    lastModified: new Date(),
  };
  reviews.set(review.reviewId, {
    review: {
      ...base,
      ...review,
      lastModified: review.lastModified ?? new Date(),
    },
    reply: current?.reply ?? null,
  });
}

const titleOf = (packageName: string) =>
  packageName
    .split(".")
    .slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const REPORT_HEADER =
  "Package Name,App Version Code,App Version Name,Reviewer Language,Device,Review Submit Date and Time,Review Submit Millis Since Epoch,Review Last Update Date and Time,Review Last Update Millis Since Epoch,Star Rating,Review Title,Review Text,Developer Reply Date and Time,Developer Reply Millis Since Epoch,Developer Reply Text,Review Link";

function mockReport(packageName: string, monthsAgo: number): Buffer {
  const base = Date.now() - (monthsAgo * 30 + 10) * 24 * HOUR;
  const rows = [0, 1, 2].map((i) => {
    const t = base + i * HOUR;
    const id = `gp:HIST-${monthsAgo}-${i}`;
    return `${packageName},210,2.1.0,en,a05m,,${t},,${t},${[5, 2, 4][i]},,"${["Solid app", "Login keeps failing", "Nice update"][i]}",,,,http://play.google.com/console/x/review-details?reviewId=${id}`;
  });
  const csv = [REPORT_HEADER, ...rows].join("\n");
  return Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(csv, "utf16le"),
  ]);
}

const monthOf = (monthsAgo: number) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export class MockPlayApi implements PlayApi {
  async listReports(
    key: ServiceAccountKey,
    bucket: string,
    prefix: string,
  ): Promise<ReportFile[]> {
    if (bucket.includes("denied"))
      throw new PlayApiError(
        "access",
        `${key.clientEmail} can't read the reports in gs://${bucket}. In Play Console → Users and permissions, open this service account and turn on "View app information and download bulk reports" under Account permissions.`,
      );
    if (!prefix.startsWith("reviews/")) return [];
    return [1, 2].map((m) => ({
      name: `${prefix}${monthOf(m)}.csv`,
      updated: `${monthOf(m)}-updated`,
      size: 1000,
    }));
  }

  async downloadReport(
    _key: ServiceAccountKey,
    _bucket: string,
    name: string,
  ): Promise<Buffer> {
    const m = /reviews_(.+)_(\d{6})\.csv$/.exec(name);
    const packageName = m?.[1] ?? "com.unknown";
    const months = [1, 2].find((n) => monthOf(n) === m?.[2]) ?? 1;
    return mockReport(packageName, months);
  }

  async verifyKey(key: ServiceAccountKey): Promise<void> {
    if (key.clientEmail.startsWith("revoked"))
      throw new PlayApiError(
        "auth",
        "Google rejected this key. It may have been deleted; create a new key.",
      );
  }

  private check(key: ServiceAccountKey, packageName: string) {
    if (
      key.clientEmail.startsWith("noaccess") ||
      packageName.endsWith(".denied")
    )
      throw new PlayApiError(
        "access",
        `${key.clientEmail} can't access ${packageName}. In Play Console, open Users and permissions, invite this email and give it "Reply to reviews" for this app.`,
      );
    if (packageName.endsWith(".missing"))
      throw new PlayApiError(
        "not_found",
        `${packageName} isn't in this Play Console account, or it has no production release yet.`,
      );
  }

  async listApps(key: ServiceAccountKey): Promise<DiscoveredApp[]> {
    if (key.clientEmail.startsWith("noreporting"))
      throw new PlayApiError(
        "disabled",
        `Turn on the Google Play Developer Reporting API for project ${key.projectId} so your apps can be found automatically: https://console.cloud.google.com/apis/library/playdeveloperreporting.googleapis.com?project=${key.projectId}`,
      );
    if (!key.clientEmail.startsWith("discover")) return [];
    return [
      { packageName: "com.discover.shop", displayName: "Discover Shop" },
      { packageName: "com.discover.wallet", displayName: "Discover Wallet" },
      { packageName: "com.discover.denied", displayName: "No Reply Access" },
      ...extraApps,
    ];
  }

  async listReviews(
    key: ServiceAccountKey,
    packageName: string,
  ): Promise<PlayReviewData[]> {
    this.check(key, packageName);
    const cutoff = Date.now() - 7 * 24 * HOUR;
    return [...appStore(packageName).values()]
      .filter((s) => s.review.lastModified.getTime() >= cutoff)
      .map((s) => ({ ...s.review, reply: s.reply }));
  }

  async reply(
    key: ServiceAccountKey,
    packageName: string,
    reviewId: string,
    text: string,
  ) {
    this.check(key, packageName);
    const stored = appStore(packageName).get(reviewId);
    if (!stored)
      throw new PlayApiError("not_found", "This review no longer exists.");
    if (text.length > 350)
      throw new PlayApiError("invalid", "Reply text is too long.");
    stored.reply = { text, lastModified: new Date() };
    return stored.reply;
  }

  async listing(key: ServiceAccountKey, packageName: string) {
    this.check(key, packageName);
    return {
      title: titleOf(packageName),
      iconUrl: null,
      contactEmail: `help@${packageName.split(".").slice(1).join("")}.example`,
      contactPhone: null,
      contactWebsite: `https://${packageName.split(".").slice(1).join("")}.example`,
    };
  }
}
