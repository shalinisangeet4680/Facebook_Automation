import { Injectable } from "@nestjs/common";

import { NotFoundError, ValidationError } from "@shared/errors/domain-error";

import {
  bucketFor,
  dailySeries,
  zonedDayStart,
  distribution,
  periodStats,
  topicTrends,
} from "../domain/analytics";
import { normalizeSettings, REPLY_MAX } from "../domain/play.types";
import { charCount, pickVariant, render } from "../domain/templates";
import { PlayReplyRow, PlayReviewRow } from "../infrastructure/play.tables";
import { PlayActor, PlayEngine } from "./play-engine.service";
import { PlayService } from "./play.service";

export type InboxFilter = "pending" | "replied" | "all";

const DAY = 86_400_000;

@Injectable()
export class PlayInboxService {
  constructor(
    private readonly engine: PlayEngine,
    private readonly play: PlayService,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private async scope(workspaceId: string, appId?: string) {
    const apps = await this.repo.apps(workspaceId);
    if (appId && !apps.some((a) => a.id === appId))
      throw new NotFoundError("This app isn't connected.");
    return {
      apps,
      ids: appId ? [appId] : apps.map((a) => a.id),
    };
  }

  private async views(rows: PlayReviewRow[]) {
    const replies = await this.repo.repliesFor(rows.map((r) => r.id));
    const byReview = new Map<string, PlayReplyRow[]>();
    for (const r of replies)
      byReview.set(r.reviewId, [...(byReview.get(r.reviewId) ?? []), r]);
    return rows.map((r) => ({
      ...this.play.reviewView(r, byReview.get(r.id) ?? []),
      appId: r.appId,
    }));
  }

  async inbox(
    workspaceId: string,
    filter: InboxFilter,
    appId: string | undefined,
    stars?: number[],
    limit = 100,
  ) {
    const { ids } = await this.scope(workspaceId, appId);
    const [open, done] = await Promise.all([
      this.repo.openReviews(workspaceId, ids, 500, stars),
      this.repo.doneReviews(workspaceId, ids, 500, stars),
    ]);
    const pending = filter === "replied" ? [] : await this.views(open);
    const replied =
      filter === "pending" ? [] : await this.views(done.slice(0, limit));
    const data = [
      ...pending.slice(0, limit),
      ...(filter === "all" ? replied.slice(0, limit) : replied),
    ];
    return {
      data,
      counts: {
        pending: open.length,
        replied: done.length,
        all: open.length + done.length,
      },
      approvable: pending
        .filter(
          (v) =>
            v.draft &&
            v.canReply &&
            ["pending_approval", "scheduled"].includes(v.draft.status) &&
            v.draft.text.trim(),
        )
        .map((v) => v.draft!.id),
    };
  }

  private async reviewOf(workspaceId: string, id: string) {
    const review = await this.repo.review(workspaceId, id);
    if (!review) throw new NotFoundError("This review doesn't exist.");
    const app = await this.play.appRow(workspaceId, review.appId);
    return { review, app };
  }

  private async withApp(app: { id: string }, reviewId: string) {
    const [view] = await this.views([(await this.repo.reviewById(reviewId))!]);
    return { ...view!, appId: app.id };
  }

  async skip(actor: PlayActor, id: string) {
    const { review, app } = await this.reviewOf(actor.workspaceId, id);
    const active = await this.repo.activeReply(review.id);
    if (active) await this.repo.updateReply(active.id, { status: "discarded" });
    await this.repo.updateReview(review.id, { skippedAt: new Date() });
    return this.withApp(app, review.id);
  }

  async unskip(actor: PlayActor, id: string) {
    const { review, app } = await this.reviewOf(actor.workspaceId, id);
    await this.repo.updateReview(review.id, { skippedAt: null });
    return this.withApp(app, review.id);
  }

  async draft(actor: PlayActor, id: string, rewrite: boolean) {
    const { review, app } = await this.reviewOf(actor.workspaceId, id);
    if (review.skippedAt)
      await this.repo.updateReview(review.id, { skippedAt: null });
    const active = await this.repo.activeReply(review.id);
    const ratingRules = await this.engine.ratingRules(app);
    const templateId =
      active?.templateId ??
      ratingRules.find((r) => r.rating === review.stars)?.templateId ??
      null;
    const template = templateId
      ? await this.repo.template(actor.workspaceId, templateId)
      : null;
    const key = await this.engine.aiKey(actor.workspaceId);
    const ws = await this.repo.workspaceSettings(actor.workspaceId);
    const allowed =
      key && (await this.engine.aiAllowance(actor.workspaceId, ws)) > 0;
    const previous = rewrite ? (active?.text ?? null) : null;
    let drafted = await this.engine.draft(
      app,
      review,
      template,
      allowed ? key : null,
      previous,
    );
    if (rewrite && drafted?.source === "template" && template) {
      const body = template.bodies[0];
      const others = (body?.variants ?? []).filter(
        (v) => render(v, this.engine.values(app, review)).text !== previous,
      );
      if (!others.length)
        throw new ValidationError(
          "Rewriting needs AI drafting. Turn it on in the app’s Settings → AI & integrations, or add more wordings to the template.",
        );
      const text = render(
        pickVariant(others, `${review.id}:${Date.now()}`),
        this.engine.values(app, review),
      ).text;
      drafted = { ...drafted, text };
    }
    if (!drafted)
      throw new ValidationError(
        allowed
          ? "Claude couldn't write a draft right now. Write the reply yourself or try again."
          : "Pick a template for this rating in the app’s Settings, or turn on AI drafting.",
      );
    await this.play.upsertDraft(actor, app, review, {
      text: drafted.text,
      templateId: drafted.templateId,
      source: drafted.source,
      status: "pending_approval",
      note:
        drafted.problem ??
        (charCount(drafted.text) > REPLY_MAX
          ? `The reply is over ${REPLY_MAX} characters; shorten it.`
          : null),
    });
    return this.withApp(app, review.id);
  }

  async approveAll(actor: PlayActor, replyIds: string[]) {
    const ids = [...new Set(replyIds)];
    if (!ids.length || ids.length > 50)
      throw new ValidationError("Choose 1 to 50 drafts.");
    const result = {
      sent: 0,
      failed: [] as { replyId: string; error: string }[],
    };
    for (const id of ids) {
      const reply = await this.repo.reply(actor.workspaceId, id);
      if (
        !reply ||
        !["pending_approval", "scheduled", "failed"].includes(reply.status)
      ) {
        result.failed.push({
          replyId: id,
          error: "This draft was already sent or discarded.",
        });
        continue;
      }
      try {
        await this.engine.send(reply, actor);
        result.sent++;
      } catch (err) {
        result.failed.push({ replyId: id, error: (err as Error).message });
      }
    }
    return result;
  }

  async analytics(
    workspaceId: string,
    appId: string | undefined,
    range: { days?: number; from?: string; to?: string; all?: boolean },
  ) {
    const { apps, ids } = await this.scope(workspaceId, appId);
    const now = new Date();
    const timezone = normalizeSettings(
      apps.find((a) => ids.includes(a.id))?.settings,
    ).timezone;
    let end = now.getTime();
    let start: number;
    if (range.from || range.to) {
      if (!range.from || !range.to)
        throw new ValidationError("Choose both a start and an end date.");
      start = zonedDayStart(range.from, timezone).getTime();
      end = Math.min(
        zonedDayStart(range.to, timezone).getTime() + DAY - 1,
        now.getTime(),
      );
      if (Number.isNaN(start) || Number.isNaN(end) || start > end)
        throw new ValidationError(
          "The start date must be before the end date.",
        );
      if (end - start > 5 * 366 * DAY)
        throw new ValidationError("Choose a range of at most 5 years.");
    } else if (range.all) {
      const first = await this.repo.firstReviewAt(workspaceId, ids);
      start = Math.min(
        first?.getTime() ?? now.getTime() - 30 * DAY,
        now.getTime() - 7 * DAY,
      );
    } else start = now.getTime() - (range.days ?? 30) * DAY;
    const days = Math.max(1, Math.ceil((end - start) / DAY));
    const bucket = bucketFor(days);
    const reviews = await this.repo.workspaceReviews(
      workspaceId,
      {
        appIds: ids,
        since: new Date(start - (range.all ? 30 : days + 30) * DAY),
      },
      300_000,
    );
    const current = periodStats(reviews, start, end);
    const previous = range.all
      ? periodStats([], start, start)
      : periodStats(reviews, start - days * DAY, start);
    const sent = await this.repo.sentRepliesBetween(
      workspaceId,
      ids,
      new Date(start),
      new Date(end),
    );
    const endDate = new Date(end);
    return {
      days,
      from: new Date(start).toISOString(),
      to: endDate.toISOString(),
      bucket,
      current,
      previous,
      repliesSent: sent,
      timeSavedHours: Math.round(((sent * 1.6) / 60) * 10) / 10,
      series: dailySeries(reviews, endDate, days, timezone, bucket),
      distribution: distribution(
        reviews.filter(
          (r) =>
            r.reviewedAt.getTime() > start && r.reviewedAt.getTime() <= end,
        ),
      ),
      topics: topicTrends(reviews, endDate, days),
    };
  }
}
