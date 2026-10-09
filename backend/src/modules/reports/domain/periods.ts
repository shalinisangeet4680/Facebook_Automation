export const REPORT_PRESETS = [
  "last_7d",
  "last_14d",
  "last_30d",
  "this_month",
  "last_month",
] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export interface Period {
  since: string;
  until: string;
}

const DAY = 86_400_000;

function parse(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayIn(timezone: string, now = new Date()): string {
  try {
    return now.toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function periodsFor(
  preset: ReportPreset,
  today: string,
): { current: Period; previous: Period } {
  const t = parse(today);
  const [y, m] = today.split("-").map(Number) as [number, number];
  const back = (
    days: number,
    length: number,
  ): { current: Period; previous: Period } => ({
    current: { since: format(t - days * DAY), until: format(t - DAY) },
    previous: {
      since: format(t - (days + length) * DAY),
      until: format(t - (days + 1) * DAY),
    },
  });
  switch (preset) {
    case "last_14d":
      return back(14, 14);
    case "last_30d":
      return back(30, 30);
    case "this_month": {
      const since = Date.UTC(y, m - 1, 1);
      const elapsed = Math.round((t - since) / DAY);
      const prevSince = Date.UTC(y, m - 2, 1);
      const prevMonthEnd = Date.UTC(y, m - 1, 0);
      return {
        current: { since: format(since), until: today },
        previous: {
          since: format(prevSince),
          until: format(Math.min(prevSince + elapsed * DAY, prevMonthEnd)),
        },
      };
    }
    case "last_month":
      return {
        current: {
          since: format(Date.UTC(y, m - 2, 1)),
          until: format(Date.UTC(y, m - 1, 0)),
        },
        previous: {
          since: format(Date.UTC(y, m - 3, 1)),
          until: format(Date.UTC(y, m - 2, 0)),
        },
      };
    default:
      return back(7, 7);
  }
}

export function daysBetween(period: Period): string[] {
  const out: string[] = [];
  for (let d = parse(period.since); d <= parse(period.until); d += DAY)
    out.push(format(d));
  return out;
}
