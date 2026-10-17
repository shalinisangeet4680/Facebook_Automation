import { VitalsRow } from "./ports/releases-api";

export const GOOGLE_THRESHOLDS = { crash: 1.09, anr: 0.47 } as const;

export interface GuardianSettings {
  enabled: boolean;
  maxCrashRate: number;
  maxAnrRate: number;
  minUsers: number;
}

export const DEFAULT_GUARDIAN: GuardianSettings = {
  enabled: false,
  maxCrashRate: GOOGLE_THRESHOLDS.crash,
  maxAnrRate: GOOGLE_THRESHOLDS.anr,
  minUsers: 500,
};

export const GUARDIAN_WINDOW_DAYS = 7;

export interface VersionHealth {
  versionCode: string;
  crashRate: number | null;
  anrRate: number | null;
  users: number;
}

export type Metric = "crash" | "anr";

export interface Breach {
  metric: Metric;
  rate: number;
  threshold: number;
  previousRate: number | null;
}

export type Verdict =
  | { action: "halt"; breaches: Breach[] }
  | { action: "wait"; reason: string }
  | { action: "ok" };

const round = (n: number) => Math.round(n * 1000) / 1000;

function weighted(rows: VitalsRow[]) {
  let users = 0;
  let sum = 0;
  for (const r of rows) {
    if (r.rate === null || r.users <= 0) continue;
    users += r.users;
    sum += r.rate * r.users;
  }
  return { users, rate: users ? round((sum / users) * 100) : null };
}

export function healthByVersion(
  crash: VitalsRow[],
  anr: VitalsRow[],
  since: string,
): Map<string, VersionHealth> {
  const recent = (rows: VitalsRow[]) => rows.filter((r) => r.day >= since);
  const codes = new Set([
    ...recent(crash).map((r) => r.versionCode),
    ...recent(anr).map((r) => r.versionCode),
  ]);
  const out = new Map<string, VersionHealth>();
  for (const code of codes) {
    const c = weighted(recent(crash).filter((r) => r.versionCode === code));
    const a = weighted(recent(anr).filter((r) => r.versionCode === code));
    out.set(code, {
      versionCode: code,
      crashRate: c.rate,
      anrRate: a.rate,
      users: Math.max(c.users, a.users),
    });
  }
  return out;
}

export function dailyRates(rows: VitalsRow[]) {
  const days = new Map<string, VitalsRow[]>();
  for (const r of rows) days.set(r.day, [...(days.get(r.day) ?? []), r]);
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({ day, ...weighted(list) }));
}

export function previousVersion(
  health: Map<string, VersionHealth>,
  current: string,
  live: string | null,
): VersionHealth | null {
  if (live && live !== current && health.has(live)) return health.get(live)!;
  const lower = [...health.values()]
    .filter((h) => Number(h.versionCode) < Number(current))
    .sort((a, b) => Number(b.versionCode) - Number(a.versionCode));
  return lower[0] ?? null;
}

export function judge(
  settings: GuardianSettings,
  current: VersionHealth | null,
  previous: VersionHealth | null,
): Verdict {
  if (!current || current.users < settings.minUsers)
    return {
      action: "wait",
      reason: `${current?.users ?? 0} users measured on this version so far; the guardian judges after ${settings.minUsers}.`,
    };
  const breaches: Breach[] = [];
  const check = (
    metric: Metric,
    rate: number | null,
    threshold: number,
    before: number | null,
  ) => {
    if (rate === null || rate <= threshold) return;
    if (before !== null && rate <= before) return;
    breaches.push({ metric, rate, threshold, previousRate: before });
  };
  check(
    "crash",
    current.crashRate,
    settings.maxCrashRate,
    previous?.crashRate ?? null,
  );
  check("anr", current.anrRate, settings.maxAnrRate, previous?.anrRate ?? null);
  return breaches.length ? { action: "halt", breaches } : { action: "ok" };
}

const METRIC_LABEL: Record<Metric, string> = {
  crash: "User-perceived crash rate",
  anr: "User-perceived ANR rate",
};

export function describeBreach(b: Breach): string {
  return `${METRIC_LABEL[b.metric]} ${b.rate}% is over the ${b.threshold}% limit${
    b.previousRate !== null ? ` (previous version ${b.previousRate}%)` : ""
  }`;
}

export function validGuardian(s: GuardianSettings): string | null {
  if (!(s.maxCrashRate > 0 && s.maxCrashRate <= 100))
    return "The crash rate limit must be between 0% and 100%.";
  if (!(s.maxAnrRate > 0 && s.maxAnrRate <= 100))
    return "The ANR rate limit must be between 0% and 100%.";
  if (
    !Number.isInteger(s.minUsers) ||
    s.minUsers < 0 ||
    s.minUsers > 10_000_000
  )
    return "The minimum users must be a whole number.";
  return null;
}
