import {
  minutesUntilQuietEnds,
  neverAutoWord,
} from "@modules/engine/domain/automation";

import {
  AutopostSettings,
  PostMetricValues,
  PostMode,
  PostStatus,
  engagementOf,
} from "./social.types";

export interface PostDecision {
  status: Extract<PostStatus, "draft" | "pending_approval" | "scheduled">;
  scheduledAt: Date;
  held: string | null;
}

export function outsideQuietHours(
  at: Date,
  settings: Pick<AutopostSettings, "quietHours" | "timezone">,
): Date {
  const wait = minutesUntilQuietEnds(
    at,
    settings.quietHours,
    settings.timezone,
  );
  return wait ? new Date(at.getTime() + wait * 60_000) : at;
}

export function decidePost(input: {
  mode: PostMode;
  text: string;
  scheduledAt: Date;
  settings: AutopostSettings;
  sameDay: number;
  sameWeek: number;
  pausedBecause: string | null;
  problems: string[];
}): PostDecision {
  const { settings } = input;
  const scheduledAt = outsideQuietHours(input.scheduledAt, settings);
  if (input.mode === "manual")
    return { status: "draft", scheduledAt, held: null };
  if (input.mode === "approval")
    return { status: "pending_approval", scheduledAt, held: null };
  const word = neverAutoWord(
    {
      reviewId: "",
      authorName: "",
      stars: 5,
      text: input.text,
      originalText: null,
      language: null,
      appVersionName: null,
      editedAfterReply: false,
    },
    settings.neverAutoWords,
  );
  const held = input.problems.length
    ? input.problems.join(" ")
    : input.pausedBecause
      ? input.pausedBecause
      : word
        ? `Mentions "${word}", so it needs your approval.`
        : input.sameDay >= settings.dailyLimit
          ? `The daily limit of ${settings.dailyLimit} automatic posts is reached for that day.`
          : input.sameWeek >= settings.weeklyLimit
            ? `The weekly limit of ${settings.weeklyLimit} automatic posts is reached.`
            : null;
  return {
    status: held ? "pending_approval" : "scheduled",
    scheduledAt,
    held,
  };
}

export function engagementDrop(
  posts: { publishedAt: Date; metrics: PostMetricValues }[],
): { recent: number; baseline: number } | null {
  const rates = [...posts]
    .filter((p) => p.metrics.reach > 0)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .map((p) => engagementOf(p.metrics) / p.metrics.reach);
  if (rates.length < 8) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const recent = avg(rates.slice(0, 3));
  const baseline = avg(rates.slice(3, 13));
  if (baseline <= 0 || recent >= baseline * 0.4) return null;
  const pct = (n: number) => Math.round(n * 1000) / 10;
  return { recent: pct(recent), baseline: pct(baseline) };
}
