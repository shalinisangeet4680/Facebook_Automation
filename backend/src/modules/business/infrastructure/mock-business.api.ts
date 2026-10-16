import {
  BusinessInfo,
  InfoPatch,
  PostContent,
  emptyMetrics,
} from "../domain/business.types";
import {
  BusinessApi,
  BusinessApiError,
  GbpAccount,
  GbpDailyMetric,
  GbpLocation,
  GbpPost,
  GbpReview,
  GbpReviewPage,
  GoogleGrant,
} from "../domain/ports/business-api";

const ACCOUNT = "accounts/1001";
const DAY = 86_400_000;

const HOURS = (
  ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const
).map((day) => ({
  day,
  open: "09:00",
  close: day === "SATURDAY" ? "14:00" : "19:00",
}));

const BASE: { name: string; info: BusinessInfo; placeId: string }[] = [
  {
    name: "locations/5001",
    placeId: "ChIJmockPatna0001",
    info: {
      title: "Sharma Dental Clinic",
      description:
        "Family dental care in Patna since 2009. Painless root canals, braces, implants and kids' dentistry.",
      phone: "+91 612 220 4455",
      website: "https://sharmadental.example.in",
      address: {
        lines: ["12 Fraser Road"],
        locality: "Patna",
        region: "Bihar",
        postalCode: "800001",
        country: "IN",
      },
      primaryCategory: "Dental clinic",
      additionalCategories: ["Orthodontist", "Pediatric dentist"],
      hours: HOURS,
    },
  },
  {
    name: "locations/5002",
    placeId: "ChIJmockPatna0002",
    info: {
      title: "Sharma Dental Clinic – Boring Road",
      description:
        "Our second clinic on Boring Road with evening appointments.",
      phone: "+91 612 220 7788",
      website: "https://sharmadental.example.in/boring-road",
      address: {
        lines: ["Shop 4, Lalit Bhawan", "Boring Road"],
        locality: "Patna",
        region: "Bihar",
        postalCode: "800013",
        country: "IN",
      },
      primaryCategory: "Dental clinic",
      additionalCategories: [],
      hours: HOURS.map((h) => ({ ...h, open: "11:00", close: "21:00" })),
    },
  },
];

const NAMES = [
  "Ankit Kumar",
  "Priya Singh",
  "Rahul Verma",
  "Neha Gupta",
  "Amit Raj",
  "Sneha Kumari",
  "Vikash Yadav",
  "Pooja Sinha",
  "Rohit Mishra",
  "Kajal Prasad",
  "Suresh Jha",
  "Ritu Sharma",
];

const TEXTS: [number, string][] = [
  [
    5,
    "Dr. Sharma explained everything clearly and the root canal was painless. Highly recommend!",
  ],
  [5, "Very clean clinic and friendly staff. My kids were comfortable."],
  [4, "Good treatment but I waited 40 minutes even with an appointment."],
  [2, "The receptionist was rude on the phone and nobody called me back."],
  [5, "Got my braces here. Great results and fair price."],
  [1, "Charged me extra for an X-ray they never explained. Too expensive."],
  [3, "Treatment was fine. Parking is very hard to find near the clinic."],
  [5, ""],
  [4, "Nice doctors, booking an appointment online was easy."],
  [2, "Waited over an hour. Service has gone down since last year."],
  [
    5,
    "Best dental clinic in Patna. Thank you for the quick help on a Sunday emergency.",
  ],
  [4, "Clean and modern. Slightly costly but worth it."],
];

const OWNER_REPLY =
  "Thank you for visiting Sharma Dental Clinic! We're glad you had a good experience. – Team Sharma Dental";

function seededReviews(location: string, now: number): GbpReview[] {
  const offset = location.endsWith("2") ? 5 : 0;
  return Array.from({ length: location.endsWith("2") ? 10 : 18 }, (_, i) => {
    const [stars, comment] = TEXTS[(i + offset) % TEXTS.length]!;
    const at = new Date(now - (i * 4 + 1) * DAY - i * 3_600_000);
    const replied = i >= 6 && stars >= 4;
    return {
      name: `${ACCOUNT}/${location}/reviews/r${location.slice(-1)}${String(i).padStart(3, "0")}`,
      reviewId: `r${location.slice(-1)}${String(i).padStart(3, "0")}`,
      reviewer: NAMES[(i + offset) % NAMES.length]!,
      reviewerPhoto: null,
      stars,
      comment,
      createTime: at,
      updateTime: at,
      reply: replied
        ? { comment: OWNER_REPLY, updateTime: new Date(at.getTime() + DAY) }
        : null,
    };
  });
}

interface MockState {
  locations: Map<string, GbpLocation>;
  reviews: Map<string, GbpReview[]>;
  posts: Map<string, GbpPost & { location: string; post: PostContent }>;
}

export class MockBusinessApi implements BusinessApi {
  readonly replies: { reviewName: string; text: string }[] = [];
  readonly deletedReplies: string[] = [];
  readonly createdPosts: { location: string; post: PostContent }[] = [];
  readonly updates: { location: string; patch: InfoPatch }[] = [];
  private readonly states = new Map<string, MockState>();
  private postSeq = 0;

  private state(refreshToken: string): MockState {
    if (refreshToken.includes("revoked"))
      throw new BusinessApiError(
        "auth",
        "Google sign-in expired or was revoked. Connect your Google account again.",
      );
    let s = this.states.get(refreshToken);
    if (!s) {
      const now = Date.now();
      s = {
        locations: new Map(
          BASE.map((b) => [
            b.name,
            {
              name: b.name,
              info: structuredClone(b.info),
              placeId: b.placeId,
              mapsUri: `https://maps.google.com/?cid=${b.placeId}`,
              newReviewUri: `https://search.google.com/local/writereview?placeid=${b.placeId}`,
              verified: true,
            },
          ]),
        ),
        reviews: new Map(BASE.map((b) => [b.name, seededReviews(b.name, now)])),
        posts: new Map(),
      };
      this.states.set(refreshToken, s);
    }
    return s;
  }

  addReview(
    refreshToken: string,
    location: string,
    review: Partial<GbpReview> & { stars: number; comment: string },
  ): GbpReview {
    const list = this.state(refreshToken).reviews.get(location) ?? [];
    const id = review.reviewId ?? `new${list.length}${Date.now() % 100_000}`;
    const now = new Date();
    const full: GbpReview = {
      name: `${ACCOUNT}/${location}/reviews/${id}`,
      reviewId: id,
      reviewer: review.reviewer ?? "New Customer",
      reviewerPhoto: null,
      stars: review.stars,
      comment: review.comment,
      createTime: review.createTime ?? now,
      updateTime: review.updateTime ?? now,
      reply: review.reply ?? null,
    };
    this.state(refreshToken).reviews.set(location, [full, ...list]);
    return full;
  }

  authUrl(redirectUri: string, state: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set("code", "mock");
    url.searchParams.set("state", state);
    return url.toString();
  }

  exchangeCode(code: string): Promise<GoogleGrant> {
    if (code === "denied")
      return Promise.reject(
        new BusinessApiError(
          "access",
          "Allow TreeVook to manage your Business Profile on Google's consent screen.",
        ),
      );
    return Promise.resolve({
      refreshToken: code === "mock" ? "mock-refresh" : `mock-refresh-${code}`,
      email:
        code === "mock"
          ? "owner@sharmadental.example.in"
          : `${code}@example.in`,
    });
  }

  accounts(refreshToken: string): Promise<GbpAccount[]> {
    this.state(refreshToken);
    return Promise.resolve([
      {
        name: ACCOUNT,
        accountName: "Sharma Dental Group",
        type: "LOCATION_GROUP",
      },
    ]);
  }

  locations(refreshToken: string): Promise<GbpLocation[]> {
    return Promise.resolve(
      [...this.state(refreshToken).locations.values()].map((l) =>
        structuredClone(l),
      ),
    );
  }

  location(refreshToken: string, location: string): Promise<GbpLocation> {
    const l = this.state(refreshToken).locations.get(location);
    if (!l)
      return Promise.reject(
        new BusinessApiError(
          "not_found",
          "Google couldn't find this business anymore.",
        ),
      );
    return Promise.resolve(structuredClone(l));
  }

  async updateLocation(
    refreshToken: string,
    location: string,
    patch: InfoPatch,
  ): Promise<GbpLocation> {
    const l = this.state(refreshToken).locations.get(location);
    if (!l)
      throw new BusinessApiError(
        "not_found",
        "Google couldn't find this business anymore.",
      );
    this.updates.push({ location, patch });
    l.info = { ...l.info, ...patch };
    return this.location(refreshToken, location);
  }

  reviews(
    refreshToken: string,
    _account: string,
    location: string,
  ): Promise<GbpReviewPage> {
    const list = this.state(refreshToken).reviews.get(location) ?? [];
    const rated = list.filter((r) => r.stars > 0);
    return Promise.resolve({
      reviews: list.map((r) => structuredClone(r)),
      averageRating: rated.length
        ? Math.round(
            (rated.reduce((n, r) => n + r.stars, 0) / rated.length) * 10,
          ) / 10
        : null,
      totalReviewCount: list.length,
    });
  }

  private find(refreshToken: string, reviewName: string): GbpReview {
    for (const list of this.state(refreshToken).reviews.values()) {
      const r = list.find((x) => x.name === reviewName);
      if (r) return r;
    }
    throw new BusinessApiError(
      "not_found",
      "Google couldn't find this review anymore.",
    );
  }

  reply(refreshToken: string, reviewName: string, text: string): Promise<void> {
    const r = this.find(refreshToken, reviewName);
    if (text.includes("FAIL_ON_GOOGLE"))
      return Promise.reject(
        new BusinessApiError("error", "Google returned an error: mock failure"),
      );
    r.reply = { comment: text, updateTime: new Date() };
    this.replies.push({ reviewName, text });
    return Promise.resolve();
  }

  deleteReply(refreshToken: string, reviewName: string): Promise<void> {
    this.find(refreshToken, reviewName).reply = null;
    this.deletedReplies.push(reviewName);
    return Promise.resolve();
  }

  createPost(
    refreshToken: string,
    _account: string,
    location: string,
    post: PostContent,
  ): Promise<GbpPost> {
    if (post.summary.includes("FAIL_ON_GOOGLE"))
      return Promise.reject(
        new BusinessApiError(
          "invalid",
          "Google rejected the post: mock failure",
        ),
      );
    const name = `${ACCOUNT}/${location}/localPosts/p${++this.postSeq}`;
    const created = {
      name,
      searchUrl: `https://local.google.com/place?id=${location.split("/")[1]}&use=posts&lpsid=p${this.postSeq}`,
      state: "LIVE",
    };
    this.state(refreshToken).posts.set(name, { ...created, location, post });
    this.createdPosts.push({ location, post });
    return Promise.resolve(created);
  }

  deletePost(refreshToken: string, postName: string): Promise<void> {
    this.state(refreshToken).posts.delete(postName);
    return Promise.resolve();
  }

  metrics(
    refreshToken: string,
    location: string,
    from: string,
    to: string,
  ): Promise<GbpDailyMetric[]> {
    this.state(refreshToken);
    const scale = location.endsWith("2") ? 0.55 : 1;
    const out: GbpDailyMetric[] = [];
    for (
      let t = Date.parse(`${from}T00:00:00Z`);
      t <= Date.parse(`${to}T00:00:00Z`);
      t += DAY
    ) {
      const i = Math.floor(t / DAY);
      const wave =
        1 +
        0.35 * Math.sin(i / 3.1) +
        (new Date(t).getUTCDay() === 0 ? -0.4 : 0);
      const m = emptyMetrics();
      m.impressionsSearch = Math.round(180 * wave * scale + (i % 7) * 4);
      m.impressionsMaps = Math.round(120 * wave * scale + (i % 5) * 3);
      m.calls = Math.round(6 * wave * scale + (i % 3));
      m.websiteClicks = Math.round(9 * wave * scale + (i % 4));
      m.directions = Math.round(11 * wave * scale + (i % 6));
      m.conversations = Math.round(2 * wave * scale);
      m.bookings = Math.round(1.5 * wave * scale);
      out.push({ day: new Date(t).toISOString().slice(0, 10), ...m });
    }
    return Promise.resolve(out);
  }
}
