import { Injectable } from "@nestjs/common";

import { NotFoundError, ValidationError } from "@shared/errors/domain-error";

import {
  dailySeries,
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
    limit = 100,
  ) {
    const { ids } = await this.scope(workspaceId, appId);
    const [open, done] = await Promise.all([
      this.repo.openReviews(workspaceId, ids, 500),
      this.repo.doneReviews(workspaceId, ids, 500),
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
          "Rewriting needs AI drafting. Turn it on in Automation → AI drafting, or add more wordings to the template.",
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
          : "Pick a template for this rating in Automation, or turn on AI drafting.",
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
    days: number,
  ) {
    const { apps, ids } = await this.scope(workspaceId, appId);
    const now = new Date();
    const reviews = await this.repo.workspaceReviews(
      workspaceId,
      { appIds: ids, since: new Date(now.getTime() - (2 * days + 30) * DAY) },
      200_000,
    );
    const to = now.getTime();
    const current = periodStats(reviews, to - days * DAY, to);
    const previous = periodStats(reviews, to - 2 * days * DAY, to - days * DAY);
    const sent = await this.repo.sentRepliesBetween(
      workspaceId,
      ids,
      new Date(to - days * DAY),
      now,
    );
    const timezone = normalizeSettings(
      apps.find((a) => ids.includes(a.id))?.settings,
    ).timezone;
    const inPeriod = reviews.filter(
      (r) => r.reviewedAt.getTime() > to - days * DAY,
    );
    return {
      days,
      current,
      previous,
      repliesSent: sent,
      timeSavedHours: Math.round(((sent * 1.6) / 60) * 10) / 10,
      series: dailySeries(reviews, now, days, timezone),
      distribution: distribution(inPeriod),
      topics: topicTrends(reviews, now, days),
    };
  }
}
