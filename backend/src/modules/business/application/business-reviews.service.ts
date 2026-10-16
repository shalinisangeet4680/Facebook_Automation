import { Injectable } from "@nestjs/common";

import {
  bucketFor,
  dailySeries,
  distribution,
  periodStats,
  topicTrends,
  zonedDayStart,
} from "@modules/engine/domain/analytics";
import { ACTIVE_REPLY_STATUSES } from "@modules/engine/domain/engine.types";
import {
  charCount,
  pickVariant,
  render,
} from "@modules/engine/domain/templates";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";

import { BUSINESS_REPLY_MAX } from "../domain/business.types";
import { BusinessApiError } from "../domain/ports/business-api";
import {
  GbpLocationRow,
  GbpReplyRow,
  GbpReviewRow,
} from "../infrastructure/business.tables";
import { BusinessActor, BusinessEngine } from "./business-engine.service";

export const REVIEW_STATES = [
  "unreplied",
  "waiting",
  "claude",
  "scheduled",
  "replied",
  "failed",
  "skipped",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];
export type InboxFilter = "pending" | "replied" | "all";

const DAY = 86_400_000;

export interface AnalyticsRange {
  days?: number;
  from?: string;
  to?: string;
  all?: boolean;
}

@Injectable()
export class BusinessReviewsService {
  constructor(private readonly engine: BusinessEngine) {}

  private get repo() {
    return this.engine.repo;
  }

  replyView(r: GbpReplyRow) {
    return {
      id: r.id,
      text: r.text,
      status: r.status,
      source: r.source,
      templateId: r.templateId,
      auto: r.auto,
      note: r.note,
      error: r.error,
      sendAt: r.sendAt?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  reviewView(review: GbpReviewRow, replies: GbpReplyRow[]) {
    const active = replies.find((r) =>
      ACTIVE_REPLY_STATUSES.includes(r.status),
    );
    const lastFailed = replies.find((r) => r.status === "failed");
    const lastSent = replies.find((r) => r.status === "sent");
    const replied = Boolean(review.replyText) && !review.editedAfterReply;
    const state: ReviewState =
      review.skippedAt && !active
        ? "skipped"
        : active
          ? active.status === "pending_approval"
            ? "waiting"
            : active.status === "needs_claude"
              ? "claude"
              : "scheduled"
          : replied
            ? "replied"
            : lastFailed &&
                (!review.repliedAt || lastFailed.updatedAt > review.repliedAt)
              ? "failed"
              : "unreplied";
    const draft = active ?? (state === "failed" ? lastFailed : undefined);
    return {
      id: review.id,
      locationId: review.locationId,
      reviewId: review.reviewId,
      authorName: review.authorName,
      authorPhoto: review.authorPhoto,
      stars: review.stars,
      text: review.text,
      language: review.language,
      reviewedAt: review.reviewedAt.toISOString(),
      reply: review.replyText
        ? {
            text: review.replyText,
            repliedAt: review.repliedAt?.toISOString() ?? null,
          }
        : null,
      editedAfterReply: review.editedAfterReply,
      starsBeforeEdit: review.starsBeforeEdit,
      topic: review.topic,
      skippedAt: review.skippedAt?.toISOString() ?? null,
      sentVia: lastSent
        ? {
            auto: lastSent.auto,
            source: lastSent.source,
            sentAt: lastSent.sentAt?.toISOString() ?? null,
          }
        : null,
      state,
      draft: draft ? this.replyView(draft) : null,
    };
  }

  private async views(rows: GbpReviewRow[]) {
    const replies = await this.repo.repliesFor(rows.map((r) => r.id));
    const byReview = new Map<string, GbpReplyRow[]>();
    for (const r of replies)
      byReview.set(r.reviewId, [...(byReview.get(r.reviewId) ?? []), r]);
    return rows.map((r) => this.reviewView(r, byReview.get(r.id) ?? []));
  }

  private async scope(workspaceId: string, locationId?: string) {
    const locations = await this.repo.locations(workspaceId);
    if (locationId && !locations.some((l) => l.id === locationId))
      throw new NotFoundError("This business isn't connected.");
    return {
      locations,
      ids: locationId ? [locationId] : locations.map((l) => l.id),
    };
  }

  async view(reviewId: string) {
    const review = await this.repo.reviewById(reviewId);
    if (!review) throw new NotFoundError("This review doesn't exist.");
    const [view] = await this.views([review]);
    return view!;
  }

  async reviews(
    workspaceId: string,
    locationId: string,
    filters: { state?: ReviewState; stars?: number[] },
  ) {
    await this.scope(workspaceId, locationId);
    const rows = await this.repo.locationReviews(
      locationId,
      filters.stars,
      2000,
    );
    const views = await this.views(rows);
    const data = filters.state
      ? views.filter((v) => v.state === filters.state)
      : views;
    const counts: Record<string, number> = {};
    for (const v of views) counts[v.state] = (counts[v.state] ?? 0) + 1;
    return { data: data.slice(0, 500), total: data.length, counts };
  }

  async inbox(
    workspaceId: string,
    filter: InboxFilter,
    locationId: string | undefined,
    stars?: number[],
    limit = 100,
  ) {
    const { ids } = await this.scope(workspaceId, locationId);
    const [open, done] = await Promise.all([
      this.repo.openReviews(workspaceId, ids, 500, stars),
      this.repo.doneReviews(workspaceId, ids, 500, stars),
    ]);
    const pending = filter === "replied" ? [] : await this.views(open);
    const replied =
      filter === "pending" ? [] : await this.views(done.slice(0, limit));
    return {
      data: [
        ...pending.slice(0, limit),
        ...(filter === "all" ? replied.slice(0, limit) : replied),
      ],
      counts: {
        pending: open.length,
        replied: done.length,
        all: open.length + done.length,
      },
      approvable: pending
        .filter(
          (v) =>
            v.draft &&
            ["pending_approval", "scheduled"].includes(v.draft.status) &&
            v.draft.text.trim(),
        )
        .map((v) => v.draft!.id),
    };
  }

  private async reviewOf(workspaceId: string, id: string) {
    const review = await this.repo.review(workspaceId, id);
    if (!review) throw new NotFoundError("This review doesn't exist.");
    const location = await this.repo.location(workspaceId, review.locationId);
    if (!location) throw new NotFoundError("This business isn't connected.");
    return { review, location };
  }

  async upsertDraft(
    actor: BusinessActor,
    location: GbpLocationRow,
    review: GbpReviewRow,
    input: {
      text: string;
      templateId?: string | null;
      source: GbpReplyRow["source"];
      status: GbpReplyRow["status"];
      note?: string | null;
    },
  ) {
    const active = await this.repo.activeReply(review.id);
    const values = {
      text: input.text.trim(),
      source: input.source,
      templateId: input.templateId ?? null,
      status: input.status,
      note: input.note ?? null,
      auto: false,
      sendAt: null,
      error: null,
    };
    if (active) return this.repo.updateReply(active.id, values);
    return this.repo.insertReply({
      ...values,
      workspaceId: location.workspaceId,
      locationId: location.id,
      reviewId: review.id,
      createdBy: actor.userId,
    });
  }

  private checkText(text: string) {
    if (!text.trim()) throw new ValidationError("Write a reply first.");
    if (charCount(text.trim()) > BUSINESS_REPLY_MAX)
      throw new ValidationError(
        `Replies can be at most ${BUSINESS_REPLY_MAX} characters.`,
      );
  }

  async replyNow(
    actor: BusinessActor,
    reviewId: string,
    input: {
      text: string;
      templateId?: string;
      source?: "manual" | "claude" | "template";
    },
  ) {
    this.checkText(input.text);
    const { review, location } = await this.reviewOf(
      actor.workspaceId,
      reviewId,
    );
    const draft = await this.upsertDraft(actor, location, review, {
      text: input.text,
      templateId: input.templateId,
      source: input.source ?? (input.templateId ? "template" : "manual"),
      status: "pending_approval",
    });
    await this.engine.send(draft, actor);
    return this.view(review.id);
  }

  async saveDraft(
    actor: BusinessActor,
    reviewId: string,
    input: {
      text: string;
      source: "manual" | "claude" | "template";
      note?: string;
    },
  ) {
    this.checkText(input.text);
    const { review, location } = await this.reviewOf(
      actor.workspaceId,
      reviewId,
    );
    if (review.skippedAt)
      await this.repo.updateReview(review.id, { skippedAt: null });
    await this.upsertDraft(actor, location, review, {
      text: input.text,
      source: input.source,
      status: "pending_approval",
      note: input.note ?? null,
    });
    return this.view(review.id);
  }

  async approve(actor: BusinessActor, replyId: string, text?: string) {
    const reply = await this.repo.reply(actor.workspaceId, replyId);
    if (
      !reply ||
      !["pending_approval", "scheduled", "failed", "needs_claude"].includes(
        reply.status,
      )
    )
      throw new NotFoundError("This draft was already sent or discarded.");
    if (text !== undefined) {
      this.checkText(text);
      reply.text = text.trim();
    }
    await this.engine.send(reply, actor);
    return this.view(reply.reviewId);
  }

  async discard(actor: BusinessActor, replyId: string) {
    const reply = await this.repo.reply(actor.workspaceId, replyId);
    if (!reply) throw new NotFoundError("This draft doesn't exist.");
    if (reply.status !== "sent")
      await this.repo.updateReply(reply.id, {
        status: "discarded",
        sendAt: null,
      });
    return this.view(reply.reviewId);
  }

  async approveAll(actor: BusinessActor, replyIds: string[]) {
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

  async skip(actor: BusinessActor, reviewId: string) {
    const { review } = await this.reviewOf(actor.workspaceId, reviewId);
    const active = await this.repo.activeReply(review.id);
    if (active) await this.repo.updateReply(active.id, { status: "discarded" });
    await this.repo.updateReview(review.id, { skippedAt: new Date() });
    return this.view(review.id);
  }

  async unskip(actor: BusinessActor, reviewId: string) {
    const { review } = await this.reviewOf(actor.workspaceId, reviewId);
    await this.repo.updateReview(review.id, { skippedAt: null });
    return this.view(review.id);
  }

  async deleteReply(actor: BusinessActor, reviewId: string) {
    const { review, location } = await this.reviewOf(
      actor.workspaceId,
      reviewId,
    );
    if (!review.replyText)
      throw new ValidationError("This review has no reply on Google.");
    try {
      await this.engine.api.deleteReply(
        await this.engine.tokenFor(location),
        review.reviewName,
      );
    } catch (err) {
      await this.engine.failConnection(location.connectionId, err);
      throw err instanceof BusinessApiError
        ? new ValidationError(err.message)
        : err;
    }
    await this.repo.updateReview(review.id, {
      replyText: null,
      repliedAt: null,
      editedAfterReply: false,
    });
    await this.engine.record(actor, "reply_deleted", review.id, {
      location: location.id,
    });
    return this.view(review.id);
  }

  async draft(actor: BusinessActor, reviewId: string, rewrite: boolean) {
    const { review, location } = await this.reviewOf(
      actor.workspaceId,
      reviewId,
    );
    if (review.skippedAt)
      await this.repo.updateReview(review.id, { skippedAt: null });
    const active = await this.repo.activeReply(review.id);
    const ratingRules = await this.engine.ratingRules(location);
    const templateId =
      active?.templateId ??
      ratingRules.find((r) => r.rating === review.stars)?.templateId ??
      null;
    const template = templateId
      ? await this.repo.template(actor.workspaceId, templateId)
      : null;
    const ws = await this.engine.workspaceAi.settings(actor.workspaceId);
    const key = this.engine.workspaceAi.keyFrom(ws);
    const allowed =
      Boolean(key) &&
      (await this.engine.aiAllowance(actor.workspaceId, ws)) > 0;
    const previous = rewrite
      ? (active?.text ?? review.replyText ?? null)
      : null;
    let drafted = await this.engine.draft(
      location,
      review,
      template,
      allowed ? key : null,
      previous,
    );
    if (rewrite && drafted?.source === "template" && template) {
      const values = this.engine.values(location, review);
      const others = (template.bodies[0]?.variants ?? []).filter(
        (v) => render(v, values, "google_business").text !== previous,
      );
      if (!others.length)
        throw new ValidationError(
          "Rewriting needs AI drafting. Turn it on in Settings, or add more wordings to the template.",
        );
      drafted = {
        ...drafted,
        text: render(
          pickVariant(others, `${review.id}:${Date.now()}`),
          values,
          "google_business",
        ).text,
      };
    }
    if (!drafted)
      throw new ValidationError(
        allowed
          ? "Claude couldn't write a draft right now. Write the reply yourself or try again."
          : "Pick a template for this rating in Settings, or turn on AI drafting.",
      );
    await this.upsertDraft(actor, location, review, {
      text: drafted.text,
      templateId: drafted.templateId,
      source: drafted.source,
      status: "pending_approval",
      note: drafted.problem,
    });
    return this.view(review.id);
  }

  async analytics(
    workspaceId: string,
    locationId: string | undefined,
    range: AnalyticsRange,
  ) {
    const { locations, ids } = await this.scope(workspaceId, locationId);
    const now = new Date();
    const timezone = locations.find((l) => ids.includes(l.id))
      ? this.engine.settingsOf(locations.find((l) => ids.includes(l.id))!)
          .timezone
      : "Asia/Kolkata";
    const { start, end } = await this.window(
      workspaceId,
      ids,
      range,
      timezone,
      now,
    );
    const days = Math.max(1, Math.ceil((end - start) / DAY));
    const bucket = bucketFor(days);
    const reviews = await this.repo.workspaceReviews(
      workspaceId,
      ids,
      new Date(start - (range.all ? 30 : days + 30) * DAY),
      300_000,
    );
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
      current: periodStats(reviews, start, end),
      previous: range.all
        ? periodStats([], start, start)
        : periodStats(reviews, start - days * DAY, start),
      repliesSent: sent,
      timeSavedHours: Math.round(((sent * 2) / 60) * 10) / 10,
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

  async window(
    workspaceId: string,
    ids: string[],
    range: AnalyticsRange,
    timezone: string,
    now: Date,
  ) {
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
    return { start, end };
  }
}
