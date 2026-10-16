import { computeInsights, topWords, words } from "./insights";
import { parseReport } from "@modules/play/domain/report-csv";

const DAY = 86_400_000;
const now = new Date("2026-10-16T12:00:00Z");

const review = (
  stars: number,
  daysAgo: number,
  extra: Record<string, unknown> = {},
) => ({
  stars,
  text: "",
  originalText: null,
  language: "en",
  appVersionName: "2.3.1",
  appVersionCode: 231,
  reviewedAt: new Date(now.getTime() - daysAgo * DAY),
  replyText: null,
  repliedAt: null,
  ...extra,
});

describe("words", () => {
  it("keeps meaningful words and drops filler, short words and the app's name", () => {
    expect(
      words(
        "The app keeps CRASHING, crashing! Acme is slow nahi chalta",
        new Set(["acme"]),
      ),
    ).toEqual(["keeps", "crashing", "slow", "chalta"]);
    expect(words("बहुत धीमा ऐप है", new Set())).toEqual(["बहुत", "धीमा"]);
  });

  it("counts each word once per review and ranks by reviews", () => {
    expect(
      topWords(
        [
          { text: "login fails login fails", originalText: null },
          { text: "login is broken", originalText: "login" },
          { text: "payment fails", originalText: null },
        ],
        new Set(),
        3,
      ),
    ).toEqual([
      { word: "fails", reviews: 2 },
      { word: "login", reviews: 2 },
      { word: "broken", reviews: 1 },
    ]);
  });
});

describe("computeInsights", () => {
  const reviews = [
    review(5, 1, {
      text: "Love it",
      replyText: "Thanks",
      repliedAt: new Date(now.getTime() - 1 * DAY + 2 * 3_600_000),
    }),
    review(1, 2, {
      text: "Crash on login",
      appVersionName: "2.4.0",
      appVersionCode: 240,
    }),
    review(2, 3, {
      text: "Login crash again",
      appVersionName: "2.4.0",
      appVersionCode: 240,
    }),
    review(4, 10),
    review(3, 40),
    review(5, 45, { text: "Old but gold", replyText: "Thanks!" }),
  ];

  it("summarises the period against the one before", () => {
    const i = computeInsights({
      reviews,
      now,
      days: 30,
      timezone: "UTC",
      appTitle: "Acme",
    });
    expect(i).toMatchObject({
      days: 30,
      weekly: false,
      reviews: 4,
      previousReviews: 2,
      rating: 3,
      previousRating: 4,
      textReviews: 3,
      replyRate: 33.3,
      previousReplyRate: 100,
      medianReplyHours: 2,
      distribution: [1, 1, 0, 1, 1],
      versions: [
        { version: "2.4.0", reviews: 2, rating: 1.5 },
        { version: "2.3.1", reviews: 2, rating: 4.5 },
      ],
      languages: [{ language: "en", reviews: 4 }],
    });
    expect(i.series).toHaveLength(30);
    expect(i.series.at(-2)).toMatchObject({
      total: 1,
      stars: [0, 0, 0, 0, 1],
      rating: 5,
    });
    expect(i.complaints.slice(0, 2)).toEqual([
      { word: "crash", reviews: 2 },
      { word: "login", reviews: 2 },
    ]);
  });

  it("switches to weekly buckets for long periods", () => {
    const i = computeInsights({
      reviews,
      now,
      days: 90,
      timezone: "UTC",
      appTitle: "Acme",
    });
    expect(i.weekly).toBe(true);
    expect(i.series).toHaveLength(13);
    expect(i.series.reduce((n, s) => n + s.total, 0)).toBe(6);
  });
});

describe("parseReport", () => {
  const header =
    "Package Name,App Version Code,App Version Name,Reviewer Language,Device,Review Submit Date and Time,Review Submit Millis Since Epoch,Review Last Update Date and Time,Review Last Update Millis Since Epoch,Star Rating,Review Title,Review Text,Developer Reply Date and Time,Developer Reply Millis Since Epoch,Developer Reply Text,Review Link";
  const csv = [
    header,
    'com.acme.shop,231,2.3.1,en,a05m,2026-09-01T10:00:00Z,1788256800000,2026-09-01T10:00:00Z,1788256800000,5,,"Great, ""really"" great",2026-09-02T10:00:00Z,1788343200000,Thanks!,http://play.google.com/console/developers/1/app/2/user-feedback/review-details?reviewId=gp:AOqpTOE123&corpus=PUBLISHED_REPLIED_TO',
    "com.acme.shop,230,2.3.0,hi,,2026-09-03T10:00:00Z,1788429600000,,,3,,,,,,",
    "com.acme.shop,,,,,,,,,9,,bad row,,,,",
  ].join("\r\n");

  it("reads Play Console's UTF-16 report", () => {
    const parsed = parseReport(
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, "utf16le")]),
    );
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.skipped).toBe(1);
    expect(parsed.packages).toEqual(["com.acme.shop"]);
    expect(parsed.rows[0]).toMatchObject({
      reviewId: "gp:AOqpTOE123",
      replyable: true,
      stars: 5,
      text: 'Great, "really" great',
      replyText: "Thanks!",
      appVersionCode: 231,
    });
    expect(parsed.rows[0]!.reviewedAt.toISOString()).toBe(
      "2026-09-01T10:00:00.000Z",
    );
    expect(parsed.rows[1]).toMatchObject({
      stars: 3,
      text: "",
      replyable: false,
      language: "hi",
    });
    expect(parsed.rows[1]!.reviewId).toMatch(/^csv:[0-9a-f]{32}$/);
  });

  it("explains files that aren't review reports", () => {
    expect(parseReport(Buffer.from("name,email\nx,y"))).toContain(
      "isn't a Play Console reviews report",
    );
  });
});
