const BUCKET = /^pubsite_prod_[a-z0-9_-]{3,60}$/i;

export function parseReportsBucket(input: string): string | null {
  const value = input
    .trim()
    .replace(/^gs:\/\//i, "")
    .replace(
      /^https:\/\/(storage\.cloud\.google\.com|console\.cloud\.google\.com\/storage\/browser)\//i,
      "",
    )
    .split(/[/?#]/)[0]!;
  return BUCKET.test(value) ? value : null;
}

export const reviewReportPrefix = (packageName: string) =>
  `reviews/reviews_${packageName}_`;

export function reportMonth(name: string): string | null {
  const m = /_(\d{6})\.csv$/i.exec(name);
  return m ? m[1]! : null;
}
