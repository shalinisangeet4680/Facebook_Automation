import {
  BusinessInfo,
  InfoPatch,
  PostContent,
  emptyMetrics,
} from "../domain/business.types";
import {
  BusinessCategory,
  GoogleSearchInput,
  NewBusiness,
  addressText,
} from "../domain/profile.types";
import {
  BusinessApi,
  BusinessApiError,
  GbpAccount,
  GbpDailyMetric,
  GbpGoogleMatch,
  GbpLocation,
  GbpMedia,
  GbpPost,
  GbpReview,
  GbpReviewPage,
  GbpVerification,
  GbpVerificationOption,
  GbpVerifyRequest,
  GbpVoiceOfMerchant,
  GoogleGrant,
  PhotoCategory,
} from "../domain/ports/business-api";

const ACCOUNT = "accounts/1001";

const MOCK_PHOTOS: [PhotoCategory, string, string][] = [
  ["LOGO", "#2F6B5E", "Logo"],
  ["COVER", "#C9A227", "Cover"],
  ["EXTERIOR", "#5B7FA6", "Outside"],
  ["INTERIOR", "#8A6FB0", "Reception"],
  ["AT_WORK", "#B5654A", "At work"],
  ["TEAMS", "#4F8A4B", "Our team"],
];

const mockImage = (color: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${color}"/><text x="400" y="320" font-family="sans-serif" font-size="56" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  )}`;
const MOCK_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const MOCK_CUSTOMERS: [string, string, string][] = [
  ["Priya Singh", "#7C5CD6", "Waiting room"],
  ["Rahul Verma", "#0E7490", "Clinic entrance"],
  ["Neha Gupta", "#C2410C", "Treatment room"],
];

const seededMedia = (location: string): GbpMedia[] => {
  const base = `${ACCOUNT}/${location}/media`;
  const owner = MOCK_PHOTOS.map(([category, color, label], i): GbpMedia => ({
    name: `${base}/p${i + 1}`,
    format: "PHOTO",
    category,
    url: mockImage(color, label),
    thumbnailUrl: mockImage(color, label),
    width: 800,
    height: 600,
    views: 120 * (i + 1),
    createTime: new Date(Date.UTC(2025, i, 1)),
    source: "owner",
    author: null,
    authorPhoto: null,
  }));
  const videos = [0, 1].map((i): GbpMedia => ({
    name: `${base}/v${i + 1}`,
    format: "VIDEO",
    category: i ? "TEAMS" : "INTERIOR",
    url: MOCK_VIDEO,
    thumbnailUrl: mockImage(i ? "#1F2937" : "#334155", ""),
    width: 1280,
    height: 720,
    views: 300 + i * 80,
    createTime: new Date(Date.UTC(2025, 6 + i, 10)),
    source: "owner",
    author: null,
    authorPhoto: null,
  }));
  const customers = MOCK_CUSTOMERS.map(
    ([author, color, label], i): GbpMedia => ({
      name: `${base}/customers/c${i + 1}`,
      format: "PHOTO",
      category: null,
      url: mockImage(color, label),
      thumbnailUrl: mockImage(color, label),
      width: 800,
      height: 600,
      views: 40 + i * 15,
      createTime: new Date(Date.UTC(2025, 8, 5 + i * 7)),
      source: "customer",
      author,
      authorPhoto: null,
    }),
  );
  return [...owner, ...videos, ...customers];
};
const DAY = 86_400_000;
export const MOCK_VERIFICATION_PIN = "123456";

export const MOCK_CATEGORIES: BusinessCategory[] = [
  ["dental_clinic", "Dental clinic"],
  ["dentist", "Dentist"],
  ["orthodontist", "Orthodontist"],
  ["pediatric_dentist", "Pediatric dentist"],
  ["medical_clinic", "Medical clinic"],
  ["doctor", "Doctor"],
  ["pharmacy", "Pharmacy"],
  ["hospital", "Hospital"],
  ["physiotherapist", "Physiotherapist"],
  ["beauty_salon", "Beauty salon"],
  ["hair_salon", "Hair salon"],
  ["spa", "Spa"],
  ["gym", "Gym"],
  ["yoga_studio", "Yoga studio"],
  ["restaurant", "Restaurant"],
  ["cafe", "Cafe"],
  ["bakery", "Bakery"],
  ["sweet_shop", "Sweet shop"],
  ["grocery_store", "Grocery store"],
  ["clothing_store", "Clothing store"],
  ["electronics_store", "Electronics store"],
  ["mobile_phone_repair_shop", "Mobile phone repair shop"],
  ["plumber", "Plumber"],
  ["electrician", "Electrician"],
  ["pest_control_service", "Pest control service"],
  ["house_cleaning_service", "House cleaning service"],
  ["tutoring_service", "Tutoring service"],
  ["coaching_center", "Coaching center"],
  ["travel_agency", "Travel agency"],
  ["real_estate_agency", "Real estate agency"],
  ["car_repair", "Car repair and maintenance service"],
  ["veterinarian", "Veterinarian"],
].map(([id, displayName]) => ({
  name: `categories/gcid:${id}`,
  displayName: displayName!,
}));

const GOOGLE_LISTINGS: GbpGoogleMatch[] = [
  {
    name: "googleLocations/ChIJmockPatna0001",
    title: "Sharma Dental Clinic",
    address: "12 Fraser Road, Patna, Bihar, 800001",
    phone: "+91 612 220 4455",
    category: "Dental clinic",
    placeId: "ChIJmockPatna0001",
    mapsUri: "https://maps.google.com/?cid=ChIJmockPatna0001",
    requestAdminRightsUri: null,
  },
  {
    name: "googleLocations/ChIJmockPatna0101",
    title: "Gupta Sweets Corner",
    address: "45 Exhibition Road, Patna, Bihar, 800001",
    phone: "+91 612 223 1100",
    category: "Sweet shop",
    placeId: "ChIJmockPatna0101",
    mapsUri: "https://maps.google.com/?cid=ChIJmockPatna0101",
    requestAdminRightsUri:
      "https://business.google.com/arc/p/ChIJmockPatna0101",
  },
  {
    name: "googleLocations/ChIJmockPatna0102",
    title: "Gupta Medical Store",
    address: "8 Ashok Rajpath, Patna, Bihar, 800004",
    phone: "+91 612 230 9988",
    category: "Pharmacy",
    placeId: "ChIJmockPatna0102",
    mapsUri: "https://maps.google.com/?cid=ChIJmockPatna0102",
    requestAdminRightsUri:
      "https://business.google.com/arc/p/ChIJmockPatna0102",
  },
];

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
  groups: GbpAccount[];
  owners: Map<string, string>;
  requests: Map<string, string>;
  verifications: Map<string, GbpVerification[]>;
}

export class MockBusinessApi implements BusinessApi {
  readonly replies: { reviewName: string; text: string }[] = [];
  readonly deletedReplies: string[] = [];
  readonly createdPosts: { location: string; post: PostContent }[] = [];
  readonly addedPhotos: {
    location: string;
    sourceUrl: string;
    category: PhotoCategory;
  }[] = [];
  private readonly mediaItems = new Map<string, GbpMedia[]>();
  private mediaSeq = 0;
  readonly updates: { location: string; patch: InfoPatch }[] = [];
  readonly created: { account: string; business: NewBusiness }[] = [];
  readonly verifyRequests: { location: string; request: GbpVerifyRequest }[] =
    [];
  private readonly states = new Map<string, MockState>();
  private postSeq = 0;
  private locationSeq = 6000;
  private verificationSeq = 0;

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
        groups: [],
        owners: new Map(),
        requests: new Map(),
        verifications: new Map(),
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
    const s = this.state(refreshToken);
    return Promise.resolve([
      {
        name: ACCOUNT,
        accountName: "Sharma Dental Group",
        type: "LOCATION_GROUP",
      },
      ...s.groups.map((g) => ({ ...g })),
    ]);
  }

  locations(refreshToken: string, account: string): Promise<GbpLocation[]> {
    const s = this.state(refreshToken);
    return Promise.resolve(
      [...s.locations.values()]
        .filter((l) => (s.owners.get(l.name) ?? ACCOUNT) === account)
        .map((l) => structuredClone(l)),
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

  private mediaOf(refreshToken: string, location: string) {
    this.mine(refreshToken, location);
    const key = `${refreshToken}|${location}`;
    let list = this.mediaItems.get(key);
    if (!list) {
      list = seededMedia(location);
      this.mediaItems.set(key, list);
    }
    return list;
  }

  media(
    refreshToken: string,
    _account: string,
    location: string,
  ): Promise<GbpMedia[]> {
    return Promise.resolve(
      this.mediaOf(refreshToken, location).map((m) => ({ ...m })),
    );
  }

  addPhoto(
    refreshToken: string,
    account: string,
    location: string,
    photo: { sourceUrl: string; category: PhotoCategory },
  ): Promise<GbpMedia> {
    const list = this.mediaOf(refreshToken, location);
    this.addedPhotos.push({ location, ...photo });
    const item: GbpMedia = {
      name: `${account}/${location}/media/u${++this.mediaSeq}`,
      format: "PHOTO",
      category: photo.category,
      url: photo.sourceUrl,
      thumbnailUrl: photo.sourceUrl,
      width: null,
      height: null,
      views: 0,
      createTime: new Date(),
      source: "owner",
      author: null,
      authorPhoto: null,
    };
    list.unshift(item);
    return Promise.resolve({ ...item });
  }

  deleteMedia(refreshToken: string, name: string): Promise<void> {
    for (const [key, list] of this.mediaItems) {
      if (!key.startsWith(`${refreshToken}|`)) continue;
      const i = list.findIndex((m) => m.name === name);
      if (i >= 0) {
        list.splice(i, 1);
        return Promise.resolve();
      }
    }
    return Promise.reject(
      new BusinessApiError("not_found", "Google couldn't find this photo."),
    );
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

  categories(refreshToken: string, query: string): Promise<BusinessCategory[]> {
    this.state(refreshToken);
    const q = query.trim().toLowerCase();
    return Promise.resolve(
      MOCK_CATEGORIES.filter(
        (c) => !q || c.displayName.toLowerCase().includes(q),
      ).slice(0, 50),
    );
  }

  searchGoogle(
    refreshToken: string,
    input: GoogleSearchInput,
  ): Promise<GbpGoogleMatch[]> {
    this.state(refreshToken);
    const words = input.query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const digits = (input.phone ?? "").replace(/\D/g, "").slice(-8);
    return Promise.resolve(
      GOOGLE_LISTINGS.filter(
        (g) =>
          (words.length &&
            words.some((w) => g.title.toLowerCase().includes(w))) ||
          (digits.length >= 6 &&
            (g.phone ?? "").replace(/\D/g, "").endsWith(digits)),
      ).map((g) => ({ ...g })),
    );
  }

  createLocation(
    refreshToken: string,
    account: string,
    business: NewBusiness,
    options: { validateOnly: boolean; requestId: string },
  ): Promise<GbpLocation | null> {
    const s = this.state(refreshToken);
    if (account !== ACCOUNT && !s.groups.some((g) => g.name === account))
      return Promise.reject(
        new BusinessApiError(
          "access",
          "This Google account can't manage this business. Make it an owner or manager in Business Profile.",
        ),
      );
    if (business.title.includes("REJECT_ON_GOOGLE"))
      return Promise.reject(
        new BusinessApiError(
          "invalid",
          "Request contains an invalid argument: title contains a forbidden word.",
        ),
      );
    if (options.validateOnly) return Promise.resolve(null);
    const known = s.requests.get(options.requestId);
    if (known) return this.location(refreshToken, known);
    const name = `locations/${++this.locationSeq}`;
    const location: GbpLocation = {
      name,
      info: {
        title: business.title.trim(),
        description: business.description,
        phone: business.phone,
        website: business.website,
        address: business.address,
        serviceArea: business.serviceArea,
        primaryCategory: business.primaryCategory?.displayName ?? null,
        additionalCategories: business.additionalCategories.map(
          (c) => c.displayName,
        ),
        hours: business.hours,
      },
      placeId: null,
      mapsUri: null,
      newReviewUri: null,
      verified: false,
    };
    s.locations.set(name, location);
    s.owners.set(name, account);
    s.requests.set(options.requestId, name);
    this.created.push({ account, business });
    return Promise.resolve(structuredClone(location));
  }

  createLocationGroup(refreshToken: string, name: string): Promise<GbpAccount> {
    const s = this.state(refreshToken);
    const group = {
      name: `accounts/${2001 + s.groups.length}`,
      accountName: name,
      type: "LOCATION_GROUP",
    };
    s.groups.push(group);
    return Promise.resolve({ ...group });
  }

  private mine(refreshToken: string, location: string): GbpLocation {
    const l = this.state(refreshToken).locations.get(location);
    if (!l)
      throw new BusinessApiError(
        "not_found",
        "Google couldn't find this business anymore.",
      );
    return l;
  }

  verificationOptions(
    refreshToken: string,
    location: string,
  ): Promise<GbpVerificationOption[]> {
    const l = this.mine(refreshToken, location);
    const none = {
      phone: null,
      email: null,
      emailEditable: false,
      address: null,
      contactName: null,
      deliveryDays: null,
    };
    const out: GbpVerificationOption[] = [];
    if (l.info.phone) {
      out.push({ ...none, method: "SMS", phone: l.info.phone });
      out.push({ ...none, method: "PHONE_CALL", phone: l.info.phone });
    }
    if (l.info.website)
      out.push({
        ...none,
        method: "EMAIL",
        email: `owner@${new URL(l.info.website).hostname}`,
        emailEditable: true,
      });
    if (l.info.address)
      out.push({
        ...none,
        method: "ADDRESS",
        address: addressText(l.info.address),
        contactName: l.info.title,
        deliveryDays: 14,
      });
    return Promise.resolve(out);
  }

  verify(
    refreshToken: string,
    location: string,
    request: GbpVerifyRequest,
  ): Promise<GbpVerification> {
    const l = this.mine(refreshToken, location);
    const s = this.state(refreshToken);
    this.verifyRequests.push({ location, request });
    const verification: GbpVerification = {
      name: `${location}/verifications/v${++this.verificationSeq}`,
      method: request.method,
      state: request.method === "AUTO" ? "COMPLETED" : "PENDING",
      createTime: new Date(),
    };
    s.verifications.set(location, [
      verification,
      ...(s.verifications.get(location) ?? []).map((v) =>
        v.state === "PENDING" ? { ...v, state: "FAILED" as const } : v,
      ),
    ]);
    if (verification.state === "COMPLETED") this.markVerified(l);
    return Promise.resolve({ ...verification });
  }

  private markVerified(l: GbpLocation) {
    l.verified = true;
    l.placeId = `ChIJmockNew${l.name.split("/")[1]}`;
    l.mapsUri = `https://maps.google.com/?cid=${l.placeId}`;
    l.newReviewUri = `https://search.google.com/local/writereview?placeid=${l.placeId}`;
  }

  completeVerification(
    refreshToken: string,
    verification: string,
    pin: string,
  ): Promise<GbpVerification> {
    const location = verification.split("/verifications/")[0]!;
    const l = this.mine(refreshToken, location);
    const list = this.state(refreshToken).verifications.get(location) ?? [];
    const v = list.find((x) => x.name === verification);
    if (!v || v.state !== "PENDING")
      return Promise.reject(
        new BusinessApiError(
          "invalid",
          "This verification isn't waiting for a code anymore. Start again.",
        ),
      );
    if (pin !== MOCK_VERIFICATION_PIN)
      return Promise.reject(
        new BusinessApiError(
          "invalid",
          "Request contains an invalid argument: the PIN is incorrect.",
        ),
      );
    v.state = "COMPLETED";
    this.markVerified(l);
    return Promise.resolve({ ...v });
  }

  verifications(
    refreshToken: string,
    location: string,
  ): Promise<GbpVerification[]> {
    this.mine(refreshToken, location);
    return Promise.resolve(
      (this.state(refreshToken).verifications.get(location) ?? []).map((v) => ({
        ...v,
      })),
    );
  }

  voiceOfMerchant(
    refreshToken: string,
    location: string,
  ): Promise<GbpVoiceOfMerchant> {
    const l = this.mine(refreshToken, location);
    const pending = (
      this.state(refreshToken).verifications.get(location) ?? []
    ).some((v) => v.state === "PENDING");
    return Promise.resolve({
      hasVoiceOfMerchant: l.verified,
      hasBusinessAuthority: true,
      pendingVerification: !l.verified && pending,
      waitingForGoogle: false,
      ownershipConflict: false,
      guidelinesIssue: null,
    });
  }
}
