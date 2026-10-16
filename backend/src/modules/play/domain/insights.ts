export interface InsightReview {
  stars: number;
  text: string;
  originalText: string | null;
  language: string | null;
  appVersionName: string | null;
  appVersionCode: number | null;
  reviewedAt: Date;
  replyText: string | null;
  repliedAt: Date | null;
}

const DAY = 86_400_000;

const STOPWORDS = new Set(
  `the and for are but not you your with this that have has was were they them their its it's i'm
  i've i'll can can't cant don't dont didn't didnt doesn't doesnt won't wont just very really also
  all any some more most much many too than then there here what when where which who why how
  from into onto over under about after before again only even ever never always still such
  our ours out off one two get got getting make made use used using give gave like app apps application
  please plz pls thanks thank good great nice best bad worst ok okay well will would could should
  been being be is am of to in on at by as an a so if or no yes my me we us he she him her his hers
  hai hain nahi nhi nahin hota hoti hote kar karo karna kya kyu kyun bhi bahut bhut aur ka ki ke ko
  se me mein par tha thi the ye yeh wo woh koi kuch sab ek hum aap app's sir mam`.split(
    /\s+/,
  ),
);

export function words(text: string, ignore: Set<string>): string[] {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{M}']+/u)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (Array.from(w).length < 3 || STOPWORDS.has(w) || ignore.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

export function topWords(
  reviews: Pick<InsightReview, "text" | "originalText">[],
  ignore: Set<string>,
  limit: number,
) {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const seen = new Set([
      ...words(r.text, ignore),
      ...words(r.originalText ?? "", ignore),
    ]);
    for (const w of seen) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2 || reviews.length < 20)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, reviews]) => ({ word, reviews }));
}

const average = (rs: { stars: number }[]) =>
  rs.length
    ? Math.round((rs.reduce((n, r) => n + r.stars, 0) / rs.length) * 100) / 100
    : null;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const dayKey = (d: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

export function buckets(now: Date, days: number, timezone: string) {
  const weekly = days > 45;
  const step = weekly ? 7 : 1;
  const count = Math.ceil(days / step);
  const out: { start: string; from: number; to: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const to = now.getTime() - i * step * DAY;
    const from = to - step * DAY;
    out.push({ start: dayKey(new Date(from + 1), timezone), from, to });
  }
  return { weekly, buckets: out };
}

export function computeInsights(input: {
  reviews: InsightReview[];
  now: Date;
  days: number;
  timezone: string;
  appTitle: string;
}) {
  const { now, days, reviews } = input;
  const since = now.getTime() - days * DAY;
  const before = since - days * DAY;
  const current = reviews.filter((r) => r.reviewedAt.getTime() > since);
  const previous = reviews.filter(
    (r) => r.reviewedAt.getTime() > before && r.reviewedAt.getTime() <= since,
  );
  const withText = current.filter((r) => r.text.trim());
  const replied = withText.filter((r) => r.replyText);
  const replyHours = replied
    .filter((r) => r.repliedAt && r.repliedAt >= r.reviewedAt)
    .map((r) => (r.repliedAt!.getTime() - r.reviewedAt.getTime()) / 3_600_000);
  const prevText = previous.filter((r) => r.text.trim());

  const { weekly, buckets: slots } = buckets(now, days, input.timezone);
  const series = slots.map((b) => {
    const inside = current.filter(
      (r) => r.reviewedAt.getTime() > b.from && r.reviewedAt.getTime() <= b.to,
    );
    const stars = [1, 2, 3, 4, 5].map(
      (s) => inside.filter((r) => r.stars === s).length,
    );
    return {
      start: b.start,
      stars,
      total: inside.length,
      rating: average(inside),
    };
  });

  const versions = new Map<string, { code: number; rs: InsightReview[] }>();
  for (const r of current) {
    if (!r.appVersionName) continue;
    const v = versions.get(r.appVersionName) ?? {
      code: r.appVersionCode ?? 0,
      rs: [],
    };
    v.code = Math.max(v.code, r.appVersionCode ?? 0);
    v.rs.push(r);
    versions.set(r.appVersionName, v);
  }

  const languages = new Map<string, number>();
  for (const r of current) {
    const l =
      (r.language ?? "unknown").toLowerCase().split(/[-_]/)[0] ?? "unknown";
    languages.set(l, (languages.get(l) ?? 0) + 1);
  }

  const ignore = new Set(
    input.appTitle
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter(Boolean),
  );

  return {
    days,
    weekly,
    rating: average(current),
    previousRating: average(previous),
    reviews: current.length,
    previousReviews: previous.length,
    textReviews: withText.length,
    replyRate: withText.length
      ? Math.round((replied.length / withText.length) * 1000) / 10
      : null,
    previousReplyRate: prevText.length
      ? Math.round(
          (prevText.filter((r) => r.replyText).length / prevText.length) * 1000,
        ) / 10
      : null,
    medianReplyHours: replyHours.length
      ? Math.round(median(replyHours)! * 10) / 10
      : null,
    distribution: [1, 2, 3, 4, 5].map(
      (s) => current.filter((r) => r.stars === s).length,
    ),
    series,
    versions: [...versions.entries()]
      .sort((a, b) => b[1].code - a[1].code)
      .slice(0, 8)
      .map(([name, v]) => ({
        version: name,
        reviews: v.rs.length,
        rating: average(v.rs)!,
      })),
    languages: [...languages.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({ language, reviews: count })),
    complaints: topWords(
      current.filter((r) => r.stars <= 2 && r.text.trim()),
      ignore,
      10,
    ),
    praise: topWords(
      current.filter((r) => r.stars >= 4 && r.text.trim()),
      ignore,
      8,
    ),
  };
}
