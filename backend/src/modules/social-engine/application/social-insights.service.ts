import { Inject, Injectable, Logger } from "@nestjs/common";

import { periodStats } from "@modules/engine/domain/analytics";
import { topWords } from "@modules/engine/domain/insights";
import {
  ESCALATION_NOTIFIER,
  EscalationNotifier,
} from "@modules/engine/domain/ports/notifier";
import { NotFoundError } from "@shared/errors/domain-error";

import { computeBestTimes, defaultBestTimes } from "../domain/best-time";
import { CLASS_STARS } from "../domain/comments";
import { engagementDrop } from "../domain/safeguards";
import {
  BestTimes,
  COMMENT_CLASSES,
  CONTENT_LABELS,
  EMPTY_POST_METRICS,
  FORMAT_LABELS,
  PostMetricValues,
  SocialPlatform,
  engagementOf,
} from "../domain/social.types";
import { addDays, isoDay, localParts } from "../domain/time";
import {
  SocialAccountRow,
  SocialAutopostRow,
} from "../infrastructure/social-engine.tables";
import { SocialActor, SocialEngine } from "./social-engine.service";

const DAY = 86_400_000;
const PAUSE_DAYS = 3;
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const hourLabel = (h: number) =>
  `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

export interface MetricTotals {
  posts: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoPlays: number;
  engagement: number;
  engagementRate: number | null;
}

function totals(
  posts: SocialAutopostRow[],
  metrics: Map<string, PostMetricValues>,
): MetricTotals {
  const t: MetricTotals = {
    posts: posts.length,
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    videoPlays: 0,
    engagement: 0,
    engagementRate: null,
  };
  for (const p of posts) {
    const m = metrics.get(p.id) ?? EMPTY_POST_METRICS;
    t.reach += m.reach;
    t.impressions += m.impressions;
    t.likes += m.likes;
    t.comments += m.comments;
    t.shares += m.shares;
    t.saves += m.saves;
    t.videoPlays += m.videoPlays;
    t.engagement += engagementOf(m);
  }
  t.engagementRate = t.reach
    ? Math.round((t.engagement / t.reach) * 1000) / 10
    : null;
  return t;
}

@Injectable()
export class SocialInsightsService {
  private readonly logger = new Logger(SocialInsightsService.name);

  constructor(
    private readonly engine: SocialEngine,
    @Inject(ESCALATION_NOTIFIER) private readonly notifier: EscalationNotifier,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  async syncMetrics(account: SocialAccountRow) {
    const creds = this.engine.usable(account);
    const now = new Date();
    const today = isoDay(now);
    const recent = await this.repo.publishedSince(
      account.id,
      new Date(now.getTime() - 30 * DAY),
    );
    const reported: string[] = [];
    for (const p of recent) {
      try {
        const { reported: flagged, ...values } =
          await this.engine.api.postInsights(creds, p.externalId!, p.format);
        await this.repo.savePostMetrics(p.id, today, values);
        if (flagged) reported.push(p.id);
      } catch (err) {
        if (this.engine.isAuthError(err)) {
          await this.engine.failAccount(account, err);
          throw err;
        }
        this.logger.warn(`Post insights failed: ${(err as Error).message}`);
      }
    }
    const days = await this.engine.api
      .accountInsights(
        creds,
        addDays(today, account.metricsSyncedAt ? -7 : -30),
        today,
      )
      .catch((err: unknown) => {
        this.logger.warn(`Account insights failed: ${(err as Error).message}`);
        return [];
      });
    await this.repo.saveAccountMetrics(account.id, days);
    const history = await this.repo.publishedSince(
      account.id,
      new Date(now.getTime() - 90 * DAY),
    );
    const metrics = await this.repo.latestPostMetrics(history.map((p) => p.id));
    const brand = await this.engine.brandFor(account.workspaceId, account);
    const measured = history
      .filter((p) => metrics.has(p.id) && p.publishedAt)
      .map((p) => ({
        publishedAt: p.publishedAt!,
        metrics: metrics.get(p.id)!,
      }));
    const settings = this.engine.settingsOf(account);
    const bestTimes = computeBestTimes(
      measured,
      settings.timezone,
      account.platform,
      brand.businessType,
    );
    const latestFollowers = [...days]
      .reverse()
      .find((d) => d.followers)?.followers;
    const updated = await this.repo.updateAccount(account.id, {
      metricsSyncedAt: now,
      bestTimes,
      ...(latestFollowers ? { followers: latestFollowers } : {}),
    });
    await this.safety(updated, measured, reported);
    return { posts: recent.length, days: days.length };
  }

  private async safety(
    account: SocialAccountRow,
    measured: { publishedAt: Date; metrics: PostMetricValues }[],
    reported: string[],
  ) {
    const settings = this.engine.settingsOf(account);
    if (!settings.autoPause || this.engine.pauseNote(account)) return;
    const drop = reported.length ? null : engagementDrop(measured);
    if (!reported.length && !drop) return;
    const reason = reported.length
      ? `Safety pause: a recent post was reported, so automatic posts and replies wait for approval for ${PAUSE_DAYS} days.`
      : `Safety pause: engagement fell from ${drop!.baseline}% to ${drop!.recent}% on the latest posts, so automatic posts and replies wait for approval for ${PAUSE_DAYS} days.`;
    await this.repo.updateAccount(account.id, {
      pausedUntil: new Date(Date.now() + PAUSE_DAYS * DAY),
      pauseReason: reason,
    });
    await this.repo.holdScheduled(account.id, reason);
    await this.engine.record(
      { userId: null, workspaceId: account.workspaceId, via: "automation" },
      "safety_paused",
      account.id,
      { reported, drop },
    );
  }

  async bestTimes(workspaceId: string, accountId: string): Promise<BestTimes> {
    const account = await this.repo.account(workspaceId, accountId);
    if (!account) throw new NotFoundError("This account isn't connected.");
    if (account.bestTimes) return account.bestTimes;
    const brand = await this.engine.brandFor(workspaceId, account);
    return defaultBestTimes(account.platform, brand.businessType);
  }

  async insights(
    workspaceId: string,
    q: { platform: SocialPlatform; accountId?: string; days?: number },
  ) {
    const days = q.days ?? 30;
    const accounts = (await this.repo.accounts(workspaceId, q.platform)).filter(
      (a) => !q.accountId || a.id === q.accountId,
    );
    if (q.accountId && !accounts.length)
      throw new NotFoundError("This account isn't connected.");
    const ids = new Set(accounts.map((a) => a.id));
    const end = new Date();
    const start = new Date(end.getTime() - days * DAY);
    const prevStart = new Date(start.getTime() - days * DAY);
    const posts = (
      await this.repo.posts(
        workspaceId,
        {
          platform: q.platform,
          accountId: q.accountId,
          statuses: ["published"],
          from: prevStart,
          to: end,
          limit: 2000,
        },
        "desc",
      )
    ).filter((p) => ids.has(p.accountId));
    const metrics = await this.repo.latestPostMetrics(posts.map((p) => p.id));
    const inRange = (p: SocialAutopostRow, from: Date, to: Date) =>
      p.publishedAt! >= from && p.publishedAt! < to;
    const current = posts.filter((p) => inRange(p, start, end));
    const previous = posts.filter((p) => inRange(p, prevStart, start));
    const rows = await this.repo.accountMetrics(
      [...ids],
      isoDay(start),
      isoDay(end),
    );
    const byDay = new Map<
      string,
      { day: string; followers: number; profileVisits: number; reach: number }
    >();
    for (const r of rows) {
      const d = byDay.get(r.day) ?? {
        day: r.day,
        followers: 0,
        profileVisits: 0,
        reach: 0,
      };
      d.followers += r.values.followers;
      d.profileVisits += r.values.profileVisits;
      d.reach += r.values.reach;
      byDay.set(r.day, d);
    }
    const series = [...byDay.values()].sort((a, b) =>
      a.day.localeCompare(b.day),
    );
    const withFollowers = series.filter((s) => s.followers);
    const engagement = (p: SocialAutopostRow) =>
      engagementOf(metrics.get(p.id) ?? EMPTY_POST_METRICS);
    const postView = (p: SocialAutopostRow) => ({
      id: p.id,
      accountId: p.accountId,
      caption: p.caption.slice(0, 200),
      format: p.format,
      contentType: p.contentType,
      permalink: p.permalink,
      publishedAt: p.publishedAt!.toISOString(),
      imageUrl: p.media.find((m) => m.kind === "image")?.url ?? null,
      metrics: metrics.get(p.id) ?? EMPTY_POST_METRICS,
      engagement: engagement(p),
    });
    const group = <K extends string>(
      list: SocialAutopostRow[],
      key: (p: SocialAutopostRow) => K,
    ) => {
      const map = new Map<K, SocialAutopostRow[]>();
      for (const p of list) map.set(key(p), [...(map.get(key(p)) ?? []), p]);
      return [...map.entries()]
        .map(([k, ps]) => {
          const t = totals(ps, metrics);
          return {
            key: k,
            posts: ps.length,
            avgEngagement: Math.round(t.engagement / ps.length),
            avgReach: Math.round(t.reach / ps.length),
          };
        })
        .sort((a, b) => b.avgEngagement - a.avgEngagement);
    };
    const byFormat = group(current, (p) => p.format);
    const byContentType = group(
      current.filter((p) => p.source !== "imported"),
      (p) => p.contentType,
    );
    const account = accounts[0];
    const best =
      account?.bestTimes ??
      (account
        ? defaultBestTimes(
            account.platform,
            (await this.engine.brandFor(workspaceId, account)).businessType,
          )
        : defaultBestTimes(q.platform, ""));
    const comments = accounts.length
      ? await this.repo.comments(workspaceId, [...ids], {
          state: "all",
          limit: 2000,
        })
      : [];
    const commentStats = periodStats(
      comments.map((c) => ({
        stars: CLASS_STARS[c.class],
        text: c.class === "spam" ? "" : c.text,
        reviewedAt: c.commentedAt,
        repliedAt: c.repliedAt,
        replyText: c.replyText,
        topic: c.class,
      })),
      start.getTime(),
      end.getTime(),
    );
    const recentComments = comments.filter(
      (c) => c.commentedAt >= start && c.class !== "spam",
    );
    const cur = totals(current, metrics);
    const prev = totals(previous, metrics);
    return {
      days,
      current: cur,
      previous: prev,
      followers: {
        total: accounts.reduce((n, a) => n + a.followers, 0),
        change:
          withFollowers.length > 1
            ? withFollowers.at(-1)!.followers - withFollowers[0]!.followers
            : 0,
      },
      profileVisits: series.reduce((n, s) => n + s.profileVisits, 0),
      series,
      topPosts: [...current]
        .sort((a, b) => engagement(b) - engagement(a))
        .slice(0, 5)
        .map(postView),
      posts: current.slice(0, 50).map(postView),
      byFormat: byFormat.map((g) => ({ ...g, format: g.key })),
      byContentType: byContentType.map((g) => ({ ...g, contentType: g.key })),
      bestTimes: best,
      comments: {
        total: recentComments.length,
        replyRate: commentStats.replyRate,
        medianResponseMinutes: commentStats.medianResponseMinutes,
        classes: COMMENT_CLASSES.map((c) => ({
          class: c,
          count: comments.filter((x) => x.class === c && x.commentedAt >= start)
            .length,
        })),
        themes: topWords(
          recentComments.map((c) => ({ text: c.text, originalText: null })),
          new Set(accounts.flatMap((a) => a.name.toLowerCase().split(/\s+/))),
          8,
        ),
      },
      recommendations: this.recommend(cur, prev, byFormat, byContentType, best),
    };
  }

  recommend(
    cur: MetricTotals,
    prev: MetricTotals,
    byFormat: { key: string; posts: number; avgEngagement: number }[],
    byContentType: { key: string; posts: number; avgEngagement: number }[],
    best: BestTimes,
  ): string[] {
    const out: string[] = [];
    const formats = byFormat.filter((f) => f.posts >= 2);
    if (formats.length >= 2 && formats.at(-1)!.avgEngagement > 0) {
      const ratio = formats[0]!.avgEngagement / formats.at(-1)!.avgEngagement;
      if (ratio >= 1.2)
        out.push(
          `${FORMAT_LABELS[formats[0]!.key as keyof typeof FORMAT_LABELS]} posts get ${ratio.toFixed(1)}× the engagement of ${FORMAT_LABELS[formats.at(-1)!.key as keyof typeof FORMAT_LABELS].toLowerCase()} posts. Plan more of them.`,
        );
    }
    const top = byContentType.find((c) => c.posts >= 1);
    if (top)
      out.push(
        `${CONTENT_LABELS[top.key as keyof typeof CONTENT_LABELS]} posts did best this period. Keep them in the weekly mix.`,
      );
    const slot = best.slots[0];
    if (slot)
      out.push(
        best.source === "own"
          ? `Your followers engage most on ${WEEKDAYS[slot.weekday]} around ${hourLabel(slot.hour)}. The calendar schedules posts then.`
          : `Not enough posts yet to learn your best time; the calendar uses ${hourLabel(slot.hour)}, a good default for your category.`,
      );
    if (prev.posts && cur.posts < prev.posts)
      out.push(
        `You posted ${cur.posts} times, ${prev.posts - cur.posts} fewer than the period before. Consistency grows reach.`,
      );
    return out;
  }

  async digest(account: SocialAccountRow, actor: SocialActor) {
    const ws = await this.engine.workspaceAi.settings(account.workspaceId);
    const webhook = this.engine.workspaceAi.slackWebhook(ws);
    if (!webhook) return false;
    const week = await this.insights(account.workspaceId, {
      platform: account.platform,
      accountId: account.id,
      days: 7,
    });
    const top = week.topPosts[0];
    const lines = [
      `${week.current.posts} posts, ${week.current.reach.toLocaleString("en-IN")} reach, ${week.current.engagement.toLocaleString("en-IN")} engagements${week.current.engagementRate !== null ? ` (${week.current.engagementRate}%)` : ""}.`,
      `Followers: ${week.followers.total.toLocaleString("en-IN")} (${week.followers.change >= 0 ? "+" : ""}${week.followers.change} this week).`,
      ...(top
        ? [
            `Top post: “${top.caption.slice(0, 80)}” with ${top.engagement} engagements.`,
          ]
        : []),
      ...week.recommendations.slice(0, 2),
    ];
    await this.notifier.digest(webhook, {
      title: `Weekly ${account.platform === "instagram" ? "Instagram" : "Facebook"} digest · ${account.username ?? account.name}`,
      lines,
      url: this.engine.url(account.platform, "/insights"),
    });
    await this.repo.updateAccount(account.id, { digestSentAt: new Date() });
    await this.engine.record(actor, "digest_sent", account.id);
    return true;
  }

  isDigestDay(account: SocialAccountRow, now = new Date()) {
    const settings = this.engine.settingsOf(account);
    const local = localParts(now, settings.timezone);
    return (
      local.weekday === 0 &&
      local.hour >= 9 &&
      (!account.digestSentAt ||
        now.getTime() - account.digestSentAt.getTime() > 6 * DAY)
    );
  }
}
