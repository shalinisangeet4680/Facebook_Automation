import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuditService } from "@modules/audit/application/audit.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { decide, ratingDrop } from "@modules/engine/domain/automation";
import {
  DEFAULT_SETTINGS,
  RatingRule,
  ReplySettings,
  ReviewFacts,
  normalizeSettings,
} from "@modules/engine/domain/engine.types";
import {
  ESCALATION_NOTIFIER,
  EscalationNotifier,
} from "@modules/engine/domain/ports/notifier";
import {
  REPLY_AI,
  ReplyAi,
  ReplyAiError,
  ReplyStyle,
} from "@modules/engine/domain/ports/reply-ai";
import {
  Rendered,
  charCount,
  firstName,
  lookup,
  pickBody,
  pickVariant,
  render,
} from "@modules/engine/domain/templates";
import { keywordTopic } from "@modules/engine/domain/topics";
import { WorkspaceAutomationRow } from "@modules/engine/infrastructure/engine.tables";
import { AppConfig, appUrl } from "@shared/config/app-config";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import { BUSINESS_REPLY_MAX, checkPost } from "../domain/business.types";
import {
  BUSINESS_API,
  BusinessApi,
  BusinessApiError,
} from "../domain/ports/business-api";
import { BUSINESS_RATING_PRESETS } from "../domain/presets";
import { BusinessRepository } from "../infrastructure/business.repository";
import {
  GbpConnectionRow,
  GbpLocationRow,
  GbpPostRow,
  GbpReplyRow,
  GbpReviewRow,
  GbpTemplateRow,
} from "../infrastructure/business.tables";

export interface BusinessActor {
  userId: string | null;
  workspaceId: string;
  via: string;
}

export const DEFAULT_BUSINESS_SETTINGS: ReplySettings = {
  ...DEFAULT_SETTINGS,
  delay: "1h",
  translateTo: "en",
};

export const factsOf = (r: GbpReviewRow): ReviewFacts => ({
  reviewId: r.reviewId,
  authorName: r.authorName,
  stars: r.stars,
  text: r.text,
  originalText: null,
  language: r.language,
  appVersionName: null,
  editedAfterReply: r.editedAfterReply,
});

export interface Drafted {
  text: string;
  source: "template" | "ai";
  templateId: string | null;
  problem: string | null;
}

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

@Injectable()
export class BusinessEngine {
  private readonly logger = new Logger(BusinessEngine.name);

  constructor(
    readonly repo: BusinessRepository,
    @Inject(BUSINESS_API) readonly api: BusinessApi,
    @Inject(REPLY_AI) private readonly ai: ReplyAi,
    @Inject(ESCALATION_NOTIFIER) private readonly notifier: EscalationNotifier,
    readonly workspaceAi: WorkspaceAiService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {
    workspaceAi.registerDraftCounter("business", (workspaceId, since) =>
      repo.aiDraftsSince(workspaceId, since),
    );
  }

  record(actor: BusinessActor, action: string, target: string, data = {}) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: actor.userId ? "user" : "system",
      actorId: actor.userId,
      action: `business.${action}`,
      target,
      data: { ...data, via: actor.via },
    });
  }

  settingsOf(location: GbpLocationRow): ReplySettings {
    return normalizeSettings({
      ...DEFAULT_BUSINESS_SETTINGS,
      ...location.settings,
    });
  }

  tokenOf(connection: GbpConnectionRow): string {
    return this.crypto.decrypt(connection.refreshTokenCiphertext);
  }

  async tokenFor(location: GbpLocationRow): Promise<string> {
    const connection = await this.repo.connectionById(location.connectionId);
    if (!connection)
      throw new NotFoundError("This business's Google connection was removed.");
    if (connection.status !== "active")
      throw new ValidationError(
        connection.error ?? "Connect your Google account again.",
      );
    return this.tokenOf(connection);
  }

  async failConnection(connectionId: string, err: unknown) {
    if (err instanceof BusinessApiError && err.kind === "auth")
      await this.repo.updateConnection(connectionId, {
        status: "error",
        error: err.message,
      });
  }

  values(
    location: GbpLocationRow,
    review: Pick<GbpReviewRow, "authorName" | "stars"> | null,
  ) {
    return {
      ...location.variables,
      first_name: review ? firstName(review.authorName) : "",
      business_name: location.title,
      app_name: location.title,
      phone: location.variables.phone || location.info.phone || "",
      website: location.variables.website || location.info.website || "",
      rating: review ? String(review.stars) : "",
    };
  }

  async ratingRules(
    location: GbpLocationRow,
    templates?: GbpTemplateRow[],
  ): Promise<RatingRule[]> {
    const settings = this.settingsOf(location);
    if (settings.ratingRules.length === 5) return settings.ratingRules;
    const all = templates ?? (await this.repo.templates(location.workspaceId));
    const byPreset = new Map(all.map((t) => [t.presetKey, t.id]));
    const ratingRules: RatingRule[] = [5, 4, 3, 2, 1].map(
      (rating) =>
        settings.ratingRules.find((r) => r.rating === rating) ?? {
          rating,
          mode: "approval",
          templateId: byPreset.get(BUSINESS_RATING_PRESETS[rating]!) ?? null,
        },
    );
    location.settings = { ...settings, ratingRules };
    await this.repo.updateLocation(location.id, {
      settings: location.settings,
    });
    return ratingRules;
  }

  renderFor(
    template: GbpTemplateRow,
    location: GbpLocationRow,
    review: GbpReviewRow,
  ): Rendered & { language: string | null } {
    const body = pickBody(template.bodies, review.language);
    if (!body) return { text: "", missing: [], tooLong: false, language: null };
    const variant = pickVariant(
      body.variants,
      `${review.reviewId}:${template.id}`,
    );
    return {
      ...render(variant, this.values(location, review), "google_business"),
      language: body.language,
    };
  }

  problemNote(rendered: Rendered): string | null {
    if (rendered.missing.length)
      return `Add ${rendered.missing.map((m) => `{${m}}`).join(", ")} in this business's placeholder values, or edit the reply.`;
    if (rendered.tooLong)
      return `The reply is over ${BUSINESS_REPLY_MAX} characters; shorten it.`;
    if (!rendered.text) return "The template produced an empty reply.";
    return null;
  }

  aiAllowance(workspaceId: string, ws: WorkspaceAutomationRow | null) {
    return this.workspaceAi.allowance(workspaceId, ws);
  }

  async draft(
    location: GbpLocationRow,
    review: GbpReviewRow,
    template: GbpTemplateRow | null,
    key: string | null,
    avoid: string | null = null,
    style: ReplyStyle | null = null,
  ): Promise<Drafted | null> {
    const settings = this.settingsOf(location);
    const rendered = template
      ? this.renderFor(template, location, review)
      : null;
    const wantsAi = !template || settings.personalize || Boolean(style);
    if (key && wantsAi) {
      const values = this.values(location, review);
      try {
        const out = await this.ai.draft(key, {
          channel: "google_business",
          subjectName: location.title,
          developerName: lookup(values, "team_name") || null,
          supportEmail: lookup(values, "support_email") || null,
          latestVersion: null,
          review: {
            author: review.authorName,
            stars: review.stars,
            text: review.text,
            language: review.language,
          },
          template: rendered?.text || null,
          tone: settings.tone,
          translate: settings.translate,
          personalize: settings.personalize,
          avoid,
          style,
          maxLength: 1000,
        });
        const text = out.text.slice(0, BUSINESS_REPLY_MAX);
        await this.repo.updateReview(review.id, {
          topic: out.topic,
          language: review.language ?? out.language,
        });
        return {
          text,
          source: "ai",
          templateId: template?.id ?? null,
          problem: null,
        };
      } catch (err) {
        if (!(err instanceof ReplyAiError)) throw err;
        this.logger.warn(`AI draft failed: ${err.message}`);
        if (!rendered) return null;
      }
    }
    if (!rendered) return null;
    return {
      text: rendered.text,
      source: "template",
      templateId: template!.id,
      problem: this.problemNote(rendered),
    };
  }

  pauseNote(location: GbpLocationRow, now = new Date()): string | null {
    return location.pausedUntil && location.pausedUntil > now
      ? (location.pauseReason ?? "Auto-replies are paused by the safety pause.")
      : null;
  }

  async sync(location: GbpLocationRow) {
    const firstSync = !location.firstSyncedAt;
    const token = await this.tokenFor(location);
    let page;
    try {
      const fresh = await this.api.location(token, location.locationName);
      page = fresh.verified
        ? await this.api.reviews(
            token,
            location.accountName,
            location.locationName,
          )
        : await this.api
            .reviews(token, location.accountName, location.locationName)
            .catch(() => ({
              reviews: [],
              averageRating: null,
              totalReviewCount: 0,
            }));
      location = await this.repo.updateLocation(location.id, {
        title: fresh.info.title || location.title,
        info: fresh.info,
        placeId: fresh.placeId,
        mapsUri: fresh.mapsUri,
        newReviewUri: fresh.newReviewUri,
        verified: fresh.verified,
        verificationState: fresh.verified
          ? "verified"
          : location.verificationState === "verified"
            ? "unverified"
            : location.verificationState,
      });
    } catch (err) {
      const message =
        err instanceof BusinessApiError
          ? err.message
          : "Reviews couldn't be fetched.";
      await this.failConnection(location.connectionId, err);
      const lost =
        err instanceof BusinessApiError &&
        (err.kind === "not_found" || err.kind === "access");
      await this.repo.updateLocation(location.id, {
        syncError: message,
        lastSyncedAt: new Date(),
        ...(lost ? { archivedAt: new Date(), archiveReason: message } : {}),
      });
      if (lost) {
        await this.repo.holdScheduled(
          location.id,
          "TreeVook lost access to this business on Google.",
        );
        await this.record(
          {
            userId: null,
            workspaceId: location.workspaceId,
            via: "automation",
          },
          "location_archived",
          location.id,
          { reason: message },
        );
        return {
          fetched: 0,
          created: 0,
          updated: 0,
          drafts: 0,
          archived: true,
        };
      }
      throw err instanceof BusinessApiError
        ? new ValidationError(message)
        : err;
    }
    const existing = new Map(
      (
        await this.repo.reviewsByGoogleIds(
          location.id,
          page.reviews.map((r) => r.reviewId),
        )
      ).map((r) => [r.reviewId, r]),
    );
    const touched: GbpReviewRow[] = [];
    let created = 0;
    for (const d of page.reviews) {
      if (!d.stars) continue;
      const row = existing.get(d.reviewId);
      const fields = {
        reviewName: d.name,
        authorName: d.reviewer,
        authorPhoto: d.reviewerPhoto,
        stars: d.stars,
        text: d.comment,
        updatedOnGoogleAt: d.updateTime,
      };
      if (!row) {
        touched.push(
          await this.repo.insertReview({
            ...fields,
            workspaceId: location.workspaceId,
            locationId: location.id,
            reviewId: d.reviewId,
            reviewedAt: d.createTime,
            replyText: d.reply?.comment ?? null,
            repliedAt: d.reply?.updateTime ?? null,
            topic: keywordTopic(d.comment, d.stars, "google_business"),
          }),
        );
        created++;
        continue;
      }
      const edited = d.updateTime.getTime() > row.updatedOnGoogleAt.getTime();
      const replyText = d.reply?.comment ?? null;
      const replyChanged = replyText !== row.replyText;
      if (!edited && !replyChanged) continue;
      const repliedAt = d.reply?.updateTime ?? null;
      const editedAfterReply =
        edited &&
        Boolean(replyText) &&
        Boolean(repliedAt && d.updateTime > repliedAt);
      const updated = await this.repo.updateReview(row.id, {
        ...fields,
        replyText,
        repliedAt,
        editedAfterReply:
          editedAfterReply || (row.editedAfterReply && !replyChanged),
        starsBeforeEdit:
          editedAfterReply && row.stars !== d.stars
            ? row.stars
            : row.starsBeforeEdit,
        ...(edited
          ? { topic: keywordTopic(d.comment, d.stars, "google_business") }
          : {}),
      });
      if (edited || (replyChanged && !replyText)) touched.push(updated);
    }
    await this.checkRating(location);
    const drafts = await this.automate(location, touched, firstSync);
    await this.repo.updateLocation(location.id, {
      lastSyncedAt: new Date(),
      syncError: null,
      averageRating: page.averageRating,
      totalReviews: page.totalReviewCount,
      ...(firstSync ? { firstSyncedAt: new Date() } : {}),
    });
    return {
      fetched: page.reviews.length,
      created,
      updated: touched.length - created,
      drafts,
      archived: false,
    };
  }

  private async checkRating(location: GbpLocationRow) {
    const settings = this.settingsOf(location);
    const now = new Date();
    if (!settings.autoPause || this.pauseNote(location, now)) return;
    const recent = await this.repo.workspaceReviews(
      location.workspaceId,
      [location.id],
      new Date(now.getTime() - 31 * DAY),
      5000,
    );
    const drop = ratingDrop(recent, now);
    if (!drop || drop.drop < 0.3) return;
    const reason = `Safety pause: the rating fell from ${drop.baseline.toFixed(2)} to ${drop.recent.toFixed(2)} in the last 24 hours, so automatic replies wait for approval.`;
    location.pausedUntil = new Date(now.getTime() + DAY);
    location.pauseReason = reason;
    await this.repo.updateLocation(location.id, {
      pausedUntil: location.pausedUntil,
      pauseReason: reason,
    });
    await this.repo.holdScheduled(location.id, reason);
    await this.record(
      { userId: null, workspaceId: location.workspaceId, via: "automation" },
      "safety_paused",
      location.id,
      drop,
    );
  }

  private async escalate(
    location: GbpLocationRow,
    review: GbpReviewRow,
    draft: string | null,
    ws: WorkspaceAutomationRow | null,
  ) {
    const webhook = this.workspaceAi.slackWebhook(ws);
    if (
      review.stars > 2 ||
      review.escalatedAt ||
      !this.settingsOf(location).escalate ||
      !webhook
    )
      return;
    try {
      await this.notifier.send(webhook, {
        subjectName: location.title,
        author: review.authorName,
        stars: review.stars,
        text: review.text,
        draft,
        url: `${appUrl(this.config)}/business/${location.id}`,
      });
      await this.repo.updateReview(review.id, { escalatedAt: new Date() });
    } catch (err) {
      this.logger.warn(`Escalation failed: ${(err as Error).message}`);
    }
  }

  private async automate(
    location: GbpLocationRow,
    reviews: GbpReviewRow[],
    firstSync: boolean,
  ) {
    if (!reviews.length) return 0;
    const templates = await this.repo.templates(
      location.workspaceId,
      location.id,
    );
    const ratingRules = await this.ratingRules(location, templates);
    const settings = { ...this.settingsOf(location), ratingRules };
    const byId = new Map(templates.map((t) => [t.id, t]));
    const ws = await this.workspaceAi.settings(location.workspaceId);
    const key = this.workspaceAi.keyFrom(ws);
    let allowance = key ? await this.aiAllowance(location.workspaceId, ws) : 0;
    let autoSentToday = await this.repo.autoRepliesSince(
      location.id,
      new Date(Date.now() - DAY),
    );
    const pausedBecause = this.pauseNote(location);
    let drafts = 0;
    for (const review of reviews.sort(
      (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
    )) {
      if (review.skippedAt) continue;
      if (await this.repo.activeReply(review.id)) continue;
      const decision = decide({
        facts: factsOf(review),
        hasReply: Boolean(review.replyText),
        rules: [],
        settings,
        autoSentToday,
        firstSync,
        now: new Date(),
        pausedBecause,
      });
      if (decision.kind !== "template") {
        if (!review.replyText) await this.escalate(location, review, null, ws);
        continue;
      }
      const base = {
        workspaceId: location.workspaceId,
        locationId: location.id,
        reviewId: review.id,
      };
      const template = decision.templateId
        ? (byId.get(decision.templateId) ?? null)
        : null;
      const drafted = await this.draft(
        location,
        review,
        template,
        allowance > 0 ? key : null,
      );
      if (drafted?.source === "ai") allowance--;
      if (!drafted) {
        await this.repo.insertReply({
          ...base,
          source: "claude",
          status: "needs_claude",
          note: "No template is set for this rating. Draft it here or ask Claude through the connector.",
        });
        await this.escalate(location, review, null, ws);
        drafts++;
        continue;
      }
      const auto = decision.auto && !drafted.problem;
      await this.repo.insertReply({
        ...base,
        text: drafted.text,
        source: drafted.source,
        templateId: drafted.templateId,
        status: auto ? "scheduled" : "pending_approval",
        auto,
        sendAt: auto ? decision.sendAt : null,
        note: drafted.problem ?? decision.heldBecause,
      });
      await this.escalate(location, review, drafted.text, ws);
      if (auto) autoSentToday++;
      drafts++;
    }
    return drafts;
  }

  async send(reply: GbpReplyRow, actor: BusinessActor): Promise<GbpReplyRow> {
    const text = reply.text.trim();
    if (!text) throw new ValidationError("Write a reply first.");
    if (charCount(text) > BUSINESS_REPLY_MAX)
      throw new ValidationError(
        `Replies can be at most ${BUSINESS_REPLY_MAX} characters.`,
      );
    const [review, location] = await Promise.all([
      this.repo.reviewById(reply.reviewId),
      this.repo.locationById(reply.locationId),
    ]);
    if (!review || !location)
      throw new NotFoundError("This review no longer exists.");
    try {
      await this.api.reply(
        await this.tokenFor(location),
        review.reviewName,
        text,
      );
      await this.repo.updateReview(review.id, {
        replyText: text,
        repliedAt: new Date(),
        editedAfterReply: false,
        starsBeforeEdit: null,
      });
      const row = await this.repo.updateReply(reply.id, {
        text,
        status: "sent",
        sentAt: new Date(),
        sentBy: actor.userId,
        error: null,
      });
      await this.record(actor, "reply_sent", review.id, {
        location: location.id,
        stars: review.stars,
        auto: reply.auto,
        source: reply.source,
      });
      return row;
    } catch (err) {
      const message =
        err instanceof BusinessApiError || err instanceof ValidationError
          ? err.message
          : "The reply couldn't be sent.";
      if (
        !(err instanceof BusinessApiError) &&
        !(err instanceof ValidationError)
      )
        this.logger.error(
          "Reply failed",
          err instanceof Error ? err.stack : String(err),
        );
      await this.failConnection(location.connectionId, err);
      await this.repo.updateReply(reply.id, {
        text,
        status: "failed",
        error: message,
      });
      throw new ValidationError(message);
    }
  }

  async sendDue(limit = 50) {
    const due = await this.repo.dueReplies(new Date(), limit);
    let sent = 0;
    let failed = 0;
    for (const reply of due) {
      try {
        await this.send(reply, {
          userId: null,
          workspaceId: reply.workspaceId,
          via: "automation",
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return { due: due.length, sent, failed };
  }

  async publish(post: GbpPostRow, actor: BusinessActor): Promise<GbpPostRow> {
    const problems = checkPost(post.content);
    if (problems.length) throw new ValidationError(problems.join(" "));
    const location = await this.repo.locationById(post.locationId);
    if (!location || location.archivedAt)
      throw new NotFoundError("This business is no longer connected.");
    try {
      const created = await this.api.createPost(
        await this.tokenFor(location),
        location.accountName,
        location.locationName,
        post.content,
      );
      const row = await this.repo.updatePost(post.id, {
        status: "published",
        publishedAt: new Date(),
        googleName: created.name,
        searchUrl: created.searchUrl,
        error: null,
      });
      await this.record(actor, "post_published", post.id, {
        location: location.id,
        type: post.type,
      });
      return row;
    } catch (err) {
      const message =
        err instanceof BusinessApiError || err instanceof ValidationError
          ? err.message
          : "The post couldn't be published.";
      await this.failConnection(location.connectionId, err);
      await this.repo.updatePost(post.id, { status: "failed", error: message });
      throw new ValidationError(message);
    }
  }

  async publishDue(limit = 20) {
    const due = await this.repo.duePosts(new Date(), limit);
    let published = 0;
    for (const post of due) {
      try {
        await this.publish(post, {
          userId: null,
          workspaceId: post.workspaceId,
          via: "schedule",
        });
        published++;
      } catch (err) {
        this.logger.warn(`Scheduled post failed: ${(err as Error).message}`);
      }
    }
    return { due: due.length, published };
  }

  async syncMetrics(location: GbpLocationRow, days = 120) {
    const end = Date.now() - 2 * DAY;
    const from = isoDay(
      location.metricsSyncedAt
        ? Math.min(location.metricsSyncedAt.getTime() - 7 * DAY, end)
        : end - days * DAY,
    );
    const rows = await this.api.metrics(
      await this.tokenFor(location),
      location.locationName,
      from,
      isoDay(end),
    );
    await this.repo.saveMetrics(location.id, rows);
    await this.repo.updateLocation(location.id, {
      metricsSyncedAt: new Date(),
    });
    return rows.length;
  }
}
