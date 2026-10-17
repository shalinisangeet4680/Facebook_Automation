const DAY = 86_400_000;

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface LocalParts {
  day: string;
  weekday: number;
  hour: number;
  minute: number;
}

export function localParts(at: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function offsetMs(at: number, timezone: string) {
  const p = localParts(new Date(at), timezone);
  const [y, m, d] = p.day.split("-").map(Number);
  const asUtc = Date.UTC(y!, m! - 1, d!, p.hour, p.minute);
  return asUtc - Math.floor(at / 60_000) * 60_000;
}

export function zonedTime(
  day: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hour, minute);
  const first = guess - offsetMs(guess, timezone);
  const second = guess - offsetMs(first, timezone);
  return new Date(second);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + n * DAY)
    .toISOString()
    .slice(0, 10);
}

export function weekStartOf(at: Date, timezone: string): string {
  const p = localParts(at, timezone);
  return addDays(p.day, -p.weekday);
}

export function nextWeekStart(at: Date, timezone: string): string {
  return addDays(weekStartOf(at, timezone), 7);
}

export function isWeekStart(day: string): boolean {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() === 1;
}

export const isoDay = (t: number | Date) =>
  new Date(t).toISOString().slice(0, 10);
