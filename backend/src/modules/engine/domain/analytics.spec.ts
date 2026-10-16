import {
  bucketFor,
  dailySeries,
  zonedDayStart,
  distribution,
  periodStats,
  replySparkline,
  topicTrends,
} from "./analytics";

const now = new Date("2026-10-16T12:00:00Z");
const h = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const review = (
  hoursAgo: number,
  stars: number,
  replyAfter: number | null,
  topic: string | null = null,
) => ({
  stars,
  text: "Some text",
  reviewedAt: h(hoursAgo),
  repliedAt: replyAfter === null ? null : h(hoursAgo - replyAfter),
  replyText: replyAfter === null ? null : "Thanks",
  topic,
});

describe("analytics", () => {
  const rows = [
    review(2, 5, 1, "Praise"),
    review(5, 1, null, "Crash"),
    review(30, 4, 3, "Praise"),
    review(200, 2, null, "Crash"),
    review(220, 2, null, "Crash"),
  ];

  it("summarises a period", () => {
    expect(
      periodStats(rows, now.getTime() - 7 * 86_400_000, now.getTime()),
    ).toEqual({
      reviews: 3,
      written: 3,
      replied: 2,
      replyRate: 67,
      medianResponseMinutes: 120,
      rating: 3.33,
    });
  });

  it("counts the rating mix", () => {
    expect(distribution(rows).map((d) => d.pct)).toEqual([20, 20, 0, 40, 20]);
  });

  it("builds daily reviews, replies and a running rating", () => {
    const s = dailySeries(rows, now, 3, "UTC");
    expect(s.map((p) => p.reviews)).toEqual([0, 1, 2]);
    expect(s.map((p) => p.replied)).toEqual([0, 1, 1]);
    expect(s[2]!.rating).toBe(2.8);
  });

  it("groups long ranges into weeks", () => {
    const s = dailySeries(rows, now, 14, "UTC", "week");
    expect(s).toHaveLength(2);
    expect(s.map((p) => p.reviews)).toEqual([2, 3]);
  });

  it("reads calendar dates in the app's time zone", () => {
    expect(zonedDayStart("2026-10-16", "Asia/Kolkata").toISOString()).toBe(
      "2026-10-15T18:30:00.000Z",
    );
    expect(zonedDayStart("2026-10-16", "UTC").toISOString()).toBe(
      "2026-10-16T00:00:00.000Z",
    );
    expect(bucketFor(30)).toBe("day");
    expect(bucketFor(365)).toBe("week");
    expect(bucketFor(1000)).toBe("month");
  });

  it("compares topics with the previous period", () => {
    expect(topicTrends(rows, now, 7)).toEqual([
      { topic: "Praise", count: 2, previous: 0, change: null, negative: false },
      { topic: "Crash", count: 1, previous: 2, change: -50, negative: true },
    ]);
  });

  it("draws a reply sparkline", () => {
    expect(replySparkline(rows, now, 3)).toEqual([0, 1, 1]);
  });
});
