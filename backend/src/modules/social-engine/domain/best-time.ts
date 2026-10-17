import {
  BestTimeSlot,
  BestTimes,
  PostMetricValues,
  SocialPlatform,
  engagementOf,
} from "./social.types";
import { localParts } from "./time";

const CATEGORY_HOURS: [RegExp, number[]][] = [
  [/food|restaurant|cafe|café|bakery|sweet|kitchen|dhaba|catering/i, [12, 19]],
  [/dental|clinic|doctor|health|hospital|pharma|physio|diagnostic/i, [10, 18]],
  [/salon|beauty|spa|gym|fitness|yoga|makeup/i, [9, 19]],
  [/shop|store|retail|fashion|boutique|jewel|saree|electronics/i, [13, 20]],
  [/school|coaching|class|tuition|academy|education|institute/i, [8, 17]],
];

const PLATFORM_HOURS: Record<SocialPlatform, number[]> = {
  instagram: [11, 19],
  facebook: [13, 20],
};

export function defaultHours(
  platform: SocialPlatform,
  businessType: string,
): number[] {
  return (
    CATEGORY_HOURS.find(([re]) => re.test(businessType))?.[1] ??
    PLATFORM_HOURS[platform]
  );
}

const emptyHeatmap = () =>
  Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

export function defaultBestTimes(
  platform: SocialPlatform,
  businessType: string,
): BestTimes {
  const hours = defaultHours(platform, businessType);
  const heatmap = emptyHeatmap();
  const slots: BestTimeSlot[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const weight = weekday === 6 ? 70 : weekday === 5 ? 85 : 100;
    hours.forEach((hour, i) => {
      const score = weight - i * 10;
      heatmap[weekday]![hour] = score;
      slots.push({ weekday, hour, score });
    });
  }
  return {
    source: "default",
    slots: slots.sort((a, b) => b.score - a.score),
    heatmap,
    basedOn: 0,
  };
}

export const MIN_POSTS_FOR_OWN_TIMES = 6;

export function computeBestTimes(
  posts: { publishedAt: Date; metrics: PostMetricValues }[],
  timezone: string,
  platform: SocialPlatform,
  businessType: string,
): BestTimes {
  const measured = posts.filter((p) => p.metrics.reach > 0);
  if (measured.length < MIN_POSTS_FOR_OWN_TIMES)
    return defaultBestTimes(platform, businessType);
  const sum = emptyHeatmap();
  const count = emptyHeatmap();
  for (const p of measured) {
    const { weekday, hour } = localParts(p.publishedAt, timezone);
    sum[weekday]![hour]! += engagementOf(p.metrics) / p.metrics.reach;
    count[weekday]![hour]! += 1;
  }
  const avg = sum.map((row, d) =>
    row.map((v, h) => (count[d]![h] ? v / count[d]![h]! : 0)),
  );
  const raw = avg.map((row) =>
    row.map((v, h) => v + 0.25 * (row[(h + 23) % 24]! + row[(h + 1) % 24]!)),
  );
  const max = Math.max(...raw.flat(), 0.000001);
  const heatmap = raw.map((row) => row.map((v) => Math.round((v / max) * 100)));
  const slots: BestTimeSlot[] = [];
  heatmap.forEach((row, weekday) =>
    row.forEach((score, hour) => {
      if (score > 0) slots.push({ weekday, hour, score });
    }),
  );
  slots.sort((a, b) => b.score - a.score);
  const fallback = defaultBestTimes(platform, businessType).slots;
  for (const f of fallback)
    if (!slots.some((s) => s.weekday === f.weekday))
      slots.push({ ...f, score: Math.min(f.score, 20) });
  return { source: "own", slots, heatmap, basedOn: measured.length };
}

export function bestHourFor(weekday: number, times: BestTimes): number {
  return (
    times.slots
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => b.score - a.score)[0]?.hour ?? 11
  );
}
