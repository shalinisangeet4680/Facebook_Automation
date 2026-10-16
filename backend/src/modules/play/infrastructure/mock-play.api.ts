import {
  PlayApi,
  PlayApiError,
  PlayReviewData,
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

export function resetMockPlay(): void {
  store.clear();
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

export class MockPlayApi implements PlayApi {
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
    return { title: titleOf(packageName), iconUrl: null };
  }
}
