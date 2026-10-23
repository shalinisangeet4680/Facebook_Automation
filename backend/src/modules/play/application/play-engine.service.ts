import { Inject, Injectable, Logger } from "@nestjs/common";
import { WorkspaceAutomationRow } from "@modules/engine/infrastructure/engine.tables";
import { ConfigService } from "@nestjs/config";

import { AuditService } from "@modules/audit/application/audit.service";
import { AppConfig, appUrl } from "@shared/config/app-config";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { decide, ratingDrop } from "@modules/engine/domain/automation";
import {
  ESCALATION_NOTIFIER,
  EscalationNotifier,
} from "@modules/engine/domain/ports/notifier";
import {
  REPLY_AI,
  ReplyAi,
  ReplyAiError,
} from "@modules/engine/domain/ports/reply-ai";
import { RATING_PRESETS } from "../domain/presets";
import { keywordTopic } from "@modules/engine/domain/topics";
import {
  PLAY_API,
  PlayApi,
  PlayApiError,
  PlayCredentials,
  PlayReviewData,
  ServiceAccountKey,
} from "../domain/ports/play-api";
import {
  ReplySettings,
  normalizeSettings,
  RatingRule,
  ReviewFacts,
  Rule,
} from "@modules/engine/domain/engine.types";
import { PlayErrorKindView, REPLY_MAX } from "../domain/play.types";
import {
  charCount,
  firstName,
  lookup,
  pickBody,
  pickVariant,
  render,
  Rendered,
} from "@modules/engine/domain/templates";
import { PlayRepository } from "../infrastructure/play.repository";
import {
  PlayAppRow,
  PlayConnectionRow,
  PlayReplyRow,
  PlayReviewRow,
  PlayRuleRow,
  PlayTemplateRow,
} from "../infrastructure/play.tables";

export interface PlayActor {
  userId: string | null;
  workspaceId: string;
  via: string;
}

export const toRule = (r: PlayRuleRow): Rule => ({
  id: r.id,
  name: r.name,
  enabled: r.enabled,
  conditions: r.conditions,
  action: r.action,
  mode: r.mode,
  delayMinutes: r.delayMinutes,
});

export const factsOf = (r: PlayReviewRow): ReviewFacts => ({
  reviewId: r.reviewId,
  authorName: r.authorName,
  stars: r.stars,
  text: r.text,
  originalText: r.originalText,
  language: r.language,
  appVersionName: r.appVersionName,
  editedAfterReply: r.editedAfterReply,
});

export interface RenderedReply extends Rendered {
  language: string | null;
}

export const syncErrorKind = (err: unknown): PlayErrorKindView =>
  err instanceof PlayApiError
    ? err.kind === "access"
      ? "no_permission"
      : err.kind === "disabled"
        ? "api_disabled"
        : err.kind === "auth"
          ? "disconnected"
          : err.kind === "quota"
            ? "quota"
            : "error"
    : "error";

export interface Drafted {
  text: string;
  source: "template" | "ai";
  templateId: string | null;
  problem: string | null;
}

@Injectable()
export class PlayEngine {
  private readonly logger = new Logger(PlayEngine.name);

  constructor(
    readonly repo: PlayRepository,
    @Inject(PLAY_API) readonly api: PlayApi,
    @Inject(REPLY_AI) private readonly ai: ReplyAi,
    @Inject(ESCALATION_NOTIFIER) private readonly notifier: EscalationNotifier,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly workspaceAi: WorkspaceAiService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {
    workspaceAi.registerDraftCounter("play", (workspaceId, since) =>
      repo.aiDraftsSince(workspaceId, since),
    );
  }

  settingsOf(app: PlayAppRow): ReplySettings {
    return normalizeSettings(app.settings);
  }

  async ratingRules(app: PlayAppRow): Promise<RatingRule[]> {
    const settings = this.settingsOf(app);
    if (settings.ratingRules.length === 5) return settings.ratingRules;
    const presets = new Map(
      (await this.repo.allTemplates(app.workspaceId))
        .filter((t) => t.presetKey && !t.appId && !t.hidden)
        .map((t) => [t.presetKey!, t.id]),
    );
    const ratingRules = [5, 4, 3, 2, 1].map(
      (rating) =>
        settings.ratingRules.find((r) => r.rating === rating) ?? {
          rating,
          mode: "approval" as const,
          templateId: presets.get(RATING_PRESETS[rating]!) ?? null,
        },
    );
    await this.repo.updateApp(app.id, {
      settings: { ...settings, ratingRules },
    });
    app.settings = { ...settings, ratingRules };
    return ratingRules;
  }

  async aiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.repo.workspaceSettings(workspaceId);
    return this.aiKeyFrom(ws);
  }

  aiKeyFrom(ws: WorkspaceAutomationRow | null): string | null {
    return this.workspaceAi.keyFrom(ws);
  }

  aiAllowance(workspaceId: string, ws: WorkspaceAutomationRow | null) {
    return this.workspaceAi.allowance(workspaceId, ws);
  }

  async draft(
    app: PlayAppRow,
    review: PlayReviewRow,
    template: PlayTemplateRow | null,
    key: string | null,
    avoid: string | null = null,
  ): Promise<Drafted | null> {
    const settings = this.settingsOf(app);
    const rendered = template ? this.renderFor(template, app, review) : null;
    const wantsAi =
      !template ||
      settings.personalize ||
      (settings.translate &&
        Boolean(rendered) &&
        !this.sameLanguage(rendered!.language, review.language));
    if (key && wantsAi) {
      const values = this.values(app, review);
      try {
        const out = await this.ai.draft(key, {
          channel: "google_play",
          subjectName: app.title,
          developerName: lookup(values, "developer_name") || null,
          supportEmail: lookup(values, "support_email") || null,
          latestVersion: app.latestVersion,
          review: {
            author: review.authorName,
            stars: review.stars,
            text: review.originalText || review.text,
            language: review.language,
          },
          template: rendered?.text || null,
          tone: settings.tone,
          translate: settings.translate,
          personalize: settings.personalize,
          avoid,
          maxLength: REPLY_MAX,
        });
        const text = out.text.slice(0, 2000);
        if (out.topic && out.topic !== review.topic)
          await this.repo.updateReview(review.id, { topic: out.topic });
        return {
          text,
          source: "ai",
          templateId: template?.id ?? null,
          problem:
            charCount(text) > REPLY_MAX
              ? `The reply is over ${REPLY_MAX} characters; shorten it.`
              : null,
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

  private sameLanguage(a: string | null, b: string | null) {
    if (!a || !b) return true;
    return (
      a.toLowerCase().split(/[-_]/)[0] === b.toLowerCase().split(/[-_]/)[0]
    );
  }

  credentialsOf(connection: PlayConnectionRow): PlayCredentials {
    if (connection.kind === "managed" || !connection.keyCiphertext)
      return {
        clientEmail: connection.clientEmail,
        projectId: connection.projectId,
      };
    return JSON.parse(
      this.crypto.decrypt(connection.keyCiphertext),
    ) as ServiceAccountKey;
  }

  async keyFor(app: PlayAppRow): Promise<PlayCredentials> {
    const connection = await this.repo.connectionById(app.connectionId);
    if (!connection)
      throw new NotFoundError("This app's Google Play connection was removed.");
    return this.credentialsOf(connection);
  }

  values(
    app: PlayAppRow,
    review: Pick<PlayReviewRow, "authorName" | "stars"> | null,
  ) {
    return {
      ...app.variables,
      first_name: review ? firstName(review.authorName) : "",
      app_name: app.title,
      latest_version: app.latestVersion ?? "",
      rating: review ? String(review.stars) : "",
    };
  }

  renderFor(
    template: PlayTemplateRow,
    app: PlayAppRow,
    review: PlayReviewRow,
  ): RenderedReply {
    const body = pickBody(template.bodies, review.language);
    if (!body) return { text: "", missing: [], tooLong: false, language: null };
    const variant = pickVariant(
      body.variants,
      `${review.reviewId}:${template.id}`,
    );
    return {
      ...render(variant, this.values(app, review)),
      language: body.language,
    };
  }

  problemNote(rendered: Rendered): string | null {
    if (rendered.missing.length)
      return `Add ${rendered.missing.map((m) => `{${m}}`).join(", ")} in this app's placeholder values, or edit the reply.`;
    if (rendered.tooLong)
      return `The reply is over ${REPLY_MAX} characters; shorten it.`;
    if (!rendered.text) return "The template produced an empty reply.";
    return null;
  }

  async sync(app: PlayAppRow) {
    const firstSync = !app.firstSyncedAt;
    const key = await this.keyFor(app);
    let data: PlayReviewData[];
    try {
      data = await this.api.listReviews(key, app.packageName, {
        translationLanguage: app.settings.translateTo || undefined,
      });
    } catch (err) {
      const message =
        err instanceof PlayApiError
          ? err.message
          : "Reviews couldn't be fetched.";
      const lost =
        err instanceof PlayApiError &&
        (err.kind === "access" || err.kind === "not_found");
      await this.repo.updateApp(app.id, {
        syncError: message,
        syncErrorKind: syncErrorKind(err),
        lastSyncedAt: new Date(),
        ...(lost ? { archivedAt: new Date(), archiveReason: message } : {}),
      });
      if (lost) {
        await this.repo.holdScheduled(
          app.id,
          "TreeVook lost access to this app on Google Play.",
        );
        await this.audit.record({
          workspaceId: app.workspaceId,
          actor: "system",
          actorId: null,
          action: "play.app_archived",
          target: app.id,
          data: { packageName: app.packageName, reason: message },
        });
        return {
          fetched: 0,
          created: 0,
          updated: 0,
          drafts: 0,
          archived: true,
        };
      }
      throw err instanceof PlayApiError ? new ValidationError(message) : err;
    }
    const existing = new Map(
      (
        await this.repo.reviewsByGoogleIds(
          app.id,
          data.map((d) => d.reviewId),
        )
      ).map((r) => [r.reviewId, r]),
    );
    const touched: PlayReviewRow[] = [];
    let created = 0;
    let latest: { code: number; name: string } | null = null;
    for (const d of data) {
      if (
        d.appVersionCode &&
        d.appVersionName &&
        (!latest || d.appVersionCode > latest.code)
      )
        latest = { code: d.appVersionCode, name: d.appVersionName };
      const row = existing.get(d.reviewId);
      const fields = {
        authorName: d.authorName,
        stars: d.stars,
        text: d.text,
        originalText: d.originalText,
        language: d.language,
        appVersionName: d.appVersionName,
        appVersionCode: d.appVersionCode,
        device: d.device,
        androidVersion: d.androidVersion,
        thumbsUp: d.thumbsUp,
        reviewedAt: d.lastModified,
      };
      if (!row) {
        touched.push(
          await this.repo.insertReview(this.repo.db, {
            ...fields,
            workspaceId: app.workspaceId,
            appId: app.id,
            reviewId: d.reviewId,
            replyText: d.reply?.text ?? null,
            repliedAt: d.reply?.lastModified ?? null,
            topic: keywordTopic(d.originalText || d.text, d.stars),
          }),
        );
        created++;
        continue;
      }
      const edited = d.lastModified.getTime() > row.reviewedAt.getTime();
      const replyChanged = d.reply && d.reply.text !== row.replyText;
      if (!edited && !replyChanged && row.thumbsUp === d.thumbsUp) continue;
      const repliedAt = d.reply?.lastModified ?? row.repliedAt;
      const editedAfterReply =
        edited &&
        Boolean(row.replyText ?? d.reply) &&
        Boolean(repliedAt && d.lastModified > repliedAt);
      const updated = await this.repo.updateReview(row.id, {
        ...fields,
        replyText: d.reply?.text ?? row.replyText,
        repliedAt,
        editedAfterReply:
          editedAfterReply || (row.editedAfterReply && !replyChanged),
        starsBeforeEdit:
          editedAfterReply && row.stars !== d.stars
            ? row.stars
            : row.starsBeforeEdit,
      });
      if (edited) touched.push(updated);
    }
    if (latest && latest.name !== app.latestVersion)
      app.latestVersion = latest.name;
    await this.tagTopics(app.id);
    await this.checkRating(app);
    const drafts = app.automation
      ? await this.automate(app, touched, firstSync)
      : 0;
    await this.repo.updateApp(app.id, {
      lastSyncedAt: new Date(),
      syncError: null,
      syncErrorKind: null,
      ...(firstSync ? { firstSyncedAt: new Date() } : {}),
      ...(latest ? { latestVersion: app.latestVersion } : {}),
    });
    return {
      fetched: data.length,
      created,
      updated: touched.length - created,
      drafts,
      archived: false,
    };
  }

  async tagTopics(appId: string) {
    for (const r of await this.repo.untaggedReviews(appId, 2000))
      await this.repo.updateReview(r.id, {
        topic: keywordTopic(r.originalText || r.text, r.stars),
      });
  }

  pauseNote(app: PlayAppRow, now = new Date()): string | null {
    return app.pausedUntil && app.pausedUntil > now
      ? (app.pauseReason ?? "Auto-replies are paused by the safety pause.")
      : null;
  }

  private async checkRating(app: PlayAppRow) {
    const settings = this.settingsOf(app);
    const now = new Date();
    if (!settings.autoPause || this.pauseNote(app, now)) return;
    const drop = ratingDrop(
      await this.repo.reviewsSince(
        app.id,
        new Date(now.getTime() - 31 * 86_400_000),
      ),
      now,
    );
    if (!drop || drop.drop < 0.3) return;
    const reason = `Safety pause: the rating fell from ${drop.baseline.toFixed(2)} to ${drop.recent.toFixed(2)} in the last 24 hours, so automatic replies wait for approval.`;
    app.pausedUntil = new Date(now.getTime() + 86_400_000);
    app.pauseReason = reason;
    await this.repo.updateApp(app.id, {
      pausedUntil: app.pausedUntil,
      pauseReason: reason,
    });
    await this.repo.holdScheduled(app.id, reason);
    await this.audit.record({
      workspaceId: app.workspaceId,
      actor: "system",
      actorId: null,
      action: "play.safety_paused",
      target: app.id,
      data: drop,
    });
  }

  private async escalate(
    app: PlayAppRow,
    review: PlayReviewRow,
    draft: string | null,
    ws: WorkspaceAutomationRow | null,
  ) {
    if (
      review.stars !== 1 ||
      review.escalatedAt ||
      !this.settingsOf(app).escalate ||
      !ws?.slackWebhookCiphertext
    )
      return;
    try {
      await this.notifier.send(this.crypto.decrypt(ws.slackWebhookCiphertext), {
        subjectName: app.title,
        author: review.authorName,
        stars: review.stars,
        text: review.originalText || review.text,
        draft,
        url: `${appUrl(this.config)}/reviews/${app.id}`,
      });
      await this.repo.updateReview(review.id, { escalatedAt: new Date() });
    } catch (err) {
      this.logger.warn(`Escalation failed: ${(err as Error).message}`);
    }
  }

  private async automate(
    app: PlayAppRow,
    reviews: PlayReviewRow[],
    firstSync: boolean,
  ) {
    if (!reviews.length) return 0;
    const rules = (await this.repo.rules(app.id)).map(toRule);
    const ratingRules = await this.ratingRules(app);
    const settings = { ...this.settingsOf(app), ratingRules };
    const templates = new Map(
      (await this.repo.allTemplates(app.workspaceId)).map((t) => [t.id, t]),
    );
    const ws = await this.repo.workspaceSettings(app.workspaceId);
    const key = this.aiKeyFrom(ws);
    let allowance = key ? await this.aiAllowance(app.workspaceId, ws) : 0;
    let autoSentToday = await this.repo.autoRepliesSince(
      app.id,
      new Date(Date.now() - 86_400_000),
    );
    const pausedBecause = this.pauseNote(app);
    let drafts = 0;
    for (const review of reviews.sort(
      (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
    )) {
      if (review.skippedAt) continue;
      if (await this.repo.activeReply(review.id)) continue;
      const decision = decide({
        facts: factsOf(review),
        hasReply: Boolean(review.replyText),
        rules,
        settings,
        autoSentToday,
        firstSync,
        now: new Date(),
        pausedBecause,
      });
      if (decision.kind === "none") {
        if (!review.replyText) await this.escalate(app, review, null, ws);
        continue;
      }
      const base = {
        workspaceId: app.workspaceId,
        appId: app.id,
        reviewId: review.id,
        ruleId: decision.ruleId,
      };
      if (decision.kind === "claude") {
        await this.repo.insertReply({
          ...base,
          source: "claude",
          status: "needs_claude",
          note: "Waiting for Claude to draft a reply.",
        });
        await this.escalate(app, review, null, ws);
        drafts++;
        continue;
      }
      const template = decision.templateId
        ? (templates.get(decision.templateId) ?? null)
        : null;
      if (decision.templateId && !template) {
        await this.repo.insertReply({
          ...base,
          source: "template",
          status: "pending_approval",
          note: "The template for this rating was deleted; write a reply or pick a template.",
        });
        drafts++;
        continue;
      }
      const drafted = await this.draft(
        app,
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
        await this.escalate(app, review, null, ws);
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
      await this.escalate(app, review, drafted.text, ws);
      if (auto) autoSentToday++;
      drafts++;
    }
    return drafts;
  }

  async send(reply: PlayReplyRow, actor: PlayActor): Promise<PlayReplyRow> {
    const text = reply.text.trim();
    if (!text) throw new ValidationError("Write a reply first.");
    if (charCount(text) > REPLY_MAX)
      throw new ValidationError(
        `Replies can be at most ${REPLY_MAX} characters.`,
      );
    const [review, app] = await Promise.all([
      this.repo.reviewById(reply.reviewId),
      this.repo.appById(reply.appId),
    ]);
    if (!review || !app)
      throw new NotFoundError("This review no longer exists.");
    if (review.reviewId.startsWith("csv:"))
      throw new ValidationError(
        "This review came from a report without a review link, so Google Play can't take a reply for it here. Reply in Play Console.",
      );
    try {
      const sent = await this.api.reply(
        await this.keyFor(app),
        app.packageName,
        review.reviewId,
        text,
      );
      await this.repo.updateReview(review.id, {
        replyText: sent.text,
        repliedAt: sent.lastModified,
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
      await this.audit.record({
        workspaceId: app.workspaceId,
        actor: actor.userId ? "user" : "system",
        actorId: actor.userId,
        action: "play.reply_sent",
        target: review.id,
        data: {
          app: app.packageName,
          stars: review.stars,
          auto: reply.auto,
          source: reply.source,
          via: actor.via,
        },
      });
      return row;
    } catch (err) {
      const message =
        err instanceof PlayApiError
          ? err.message
          : "The reply couldn't be sent.";
      if (!(err instanceof PlayApiError))
        this.logger.error(
          "Reply failed",
          err instanceof Error ? err.stack : String(err),
        );
      await this.repo.updateReply(reply.id, {
        text,
        status: "failed",
        error: message,
      });
      if (err instanceof PlayApiError && ["access", "auth"].includes(err.kind))
        await this.repo.updateApp(app.id, {
          syncError: message,
          syncErrorKind: syncErrorKind(err),
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
}
