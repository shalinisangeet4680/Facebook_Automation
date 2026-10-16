import { Topic } from "./engine.types";

export interface AnalyticsReview {
  stars: number;
  text: string;
  reviewedAt: Date;
  repliedAt: Date | null;
  replyText: string | null;
  topic: string | null;
}

const DAY = 86_400_000;

export const NEGATIVE_TOPICS: Topic[] = [
  "Crash",
  "Sync",
  "Login",
  "Payment",
  "Performance",
  "Ads",
  "Support",
];

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function startOfDay(t: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
  return parts;
}

export interface PeriodStats {
  reviews: number;
  written: number;
  replied: number;
  replyRate: number | null;
  medianResponseMinutes: number | null;
  rating: number | null;
}

export function periodStats(
  reviews: AnalyticsReview[],
  from: number,
  to: number,
): PeriodStats {
  const inRange = reviews.filter(
    (r) => r.reviewedAt.getTime() > from && r.reviewedAt.getTime() <= to,
  );
  const written = inRange.filter((r) => r.text.trim());
  const replied = written.filter((r) => r.replyText);
  const waits = replied
    .filter((r) => r.repliedAt && r.repliedAt >= r.reviewedAt)
    .map((r) => (r.repliedAt!.getTime() - r.reviewedAt.getTime()) / 60_000);
  return {
    reviews: inRange.length,
    written: written.length,
    replied: replied.length,
    replyRate: written.length
      ? Math.round((replied.length / written.length) * 100)
      : null,
    medianResponseMinutes: median(waits),
    rating: inRange.length
      ? round(inRange.reduce((n, r) => n + r.stars, 0) / inRange.length)
      : null,
  };
}

export function distribution(reviews: { stars: number }[]) {
  const counts = [5, 4, 3, 2, 1].map(
    (s) => reviews.filter((r) => r.stars === s).length,
  );
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((n, i) => ({
    stars: 5 - i,
    count: n,
    pct: total ? Math.round((n / total) * 100) : 0,
  }));
}

export type Bucket = "day" | "week" | "month";

export function bucketFor(days: number): Bucket {
  return days <= 92 ? "day" : days <= 730 ? "week" : "month";
}

const BUCKET_DAYS: Record<Bucket, number> = { day: 1, week: 7, month: 30 };

export function dailySeries(
  reviews: AnalyticsReview[],
  now: Date,
  days: number,
  timezone: string,
  bucket: Bucket = "day",
) {
  const size = BUCKET_DAYS[bucket];
  const count = Math.max(1, Math.ceil(days / size));
  const first = now.getTime() - (count * size - 1) * DAY;
  const keys = Array.from({ length: count * size }, (_, i) =>
    startOfDay(first + i * DAY, timezone),
  );
  const dayIndex = new Map(keys.map((k, i) => [k, Math.floor(i / size)]));
  const points = Array.from({ length: count }, (_, i) => ({
    day: keys[i * size]!,
    reviews: 0,
    replied: 0,
    starSum: 0,
    rating: null as number | null,
  }));
  for (const r of reviews) {
    const i = dayIndex.get(startOfDay(r.reviewedAt.getTime(), timezone));
    if (i !== undefined) {
      points[i]!.reviews++;
      points[i]!.starSum += r.stars;
    }
    if (r.repliedAt && r.replyText) {
      const j = dayIndex.get(startOfDay(r.repliedAt.getTime(), timezone));
      if (j !== undefined) points[j]!.replied++;
    }
  }
  let running: number | null = null;
  const before = reviews.filter(
    (r) =>
      r.reviewedAt.getTime() < first &&
      r.reviewedAt.getTime() >= first - 30 * DAY,
  );
  let sum = before.reduce((n, r) => n + r.stars, 0);
  let n = before.length;
  for (const p of points) {
    sum += p.starSum;
    n += p.reviews;
    running = n ? round(sum / n) : running;
    p.rating = running;
  }
  return points.map(({ day, reviews, replied, rating }) => ({
    day,
    reviews,
    replied,
    rating,
  }));
}

export function zonedDayStart(date: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return new Date(utc - (shown - utc));
}

export function topicTrends(
  reviews: AnalyticsReview[],
  now: Date,
  days: number,
  limit = 5,
) {
  const to = now.getTime();
  const from = to - days * DAY;
  const prev = from - days * DAY;
  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const r of reviews) {
    if (!r.topic || r.topic === "Other" || !r.text.trim()) continue;
    const t = r.reviewedAt.getTime();
    if (t > from && t <= to)
      current.set(r.topic, (current.get(r.topic) ?? 0) + 1);
    else if (t > prev && t <= from)
      previous.set(r.topic, (previous.get(r.topic) ?? 0) + 1);
  }
  return [...current.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic, count]) => {
      const before = previous.get(topic) ?? 0;
      return {
        topic,
        count,
        previous: before,
        change: before ? Math.round(((count - before) / before) * 100) : null,
        negative: (NEGATIVE_TOPICS as string[]).includes(topic),
      };
    });
}

export function replySparkline(
  reviews: Pick<AnalyticsReview, "repliedAt" | "replyText">[],
  now: Date,
  days: number,
) {
  const out = Array.from({ length: days }, () => 0);
  for (const r of reviews) {
    if (!r.repliedAt || !r.replyText) continue;
    const ago = Math.floor((now.getTime() - r.repliedAt.getTime()) / DAY);
    if (ago >= 0 && ago < days) out[days - 1 - ago]!++;
  }
  return out;
}
