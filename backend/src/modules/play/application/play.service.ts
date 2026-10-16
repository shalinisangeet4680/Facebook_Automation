import { Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import { PlayApiError, ServiceAccountKey } from "../domain/ports/play-api";
import {
  ACTIVE_REPLY_STATUSES,
  AppSettings,
  DEFAULT_SETTINGS,
  REPLY_MAX,
  RuleAction,
  RuleConditions,
  RuleMode,
  TEMPLATE_CATEGORIES,
  TemplateBody,
  TemplateCategory,
} from "../domain/play.types";
import { PRESET_RULES, PRESET_TEMPLATES } from "../domain/presets";
import { PACKAGE_NAME, parseServiceAccount } from "../domain/service-account";
import {
  BUILT_IN_VARIABLES,
  charCount,
  SUGGESTED_VARIABLES,
  VARIABLE_NAME,
  checkTemplate,
  render,
} from "../domain/templates";
import {
  PlayAppRow,
  PlayReplyRow,
  PlayReviewRow,
  PlayRuleRow,
  PlayTemplateRow,
} from "../infrastructure/play.tables";
import { PlayActor, PlayEngine } from "./play-engine.service";

const LANG = /^[a-z]{2,3}([-_][A-Za-z]{2,4})?$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ReviewState =
  "unreplied" | "waiting" | "claude" | "scheduled" | "failed" | "replied";
export const REVIEW_STATES: ReviewState[] = [
  "unreplied",
  "waiting",
  "claude",
  "scheduled",
  "failed",
  "replied",
];

export interface RuleInput {
  id?: string;
  name: string;
  enabled: boolean;
  conditions: RuleConditions;
  action: RuleAction;
  mode: RuleMode;
  delayMinutes: number;
}

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  bodies: TemplateBody[];
  appId?: string | null;
}

export interface AppUpdate {
  title?: string;
  automation?: boolean;
  settings?: Partial<AppSettings>;
  variables?: Record<string, string>;
}

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

@Injectable()
export class PlayService {
  constructor(
    private readonly engine: PlayEngine,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private record(
    actor: PlayActor,
    action: string,
    target: string,
    data: Record<string, unknown> = {},
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action,
      target,
      data: { ...data, via: actor.via },
    });
  }

  async connections(workspaceId: string) {
    const [rows, apps] = await Promise.all([
      this.repo.connections(workspaceId),
      this.repo.apps(workspaceId),
    ]);
    return {
      data: rows.map((c) => ({
        id: c.id,
        clientEmail: c.clientEmail,
        projectId: c.projectId,
        status: c.status,
        error: c.error,
        checkedAt: c.checkedAt?.toISOString() ?? null,
        apps: apps.filter((a) => a.connectionId === c.id).length,
      })),
    };
  }

  async connect(actor: PlayActor, raw: string) {
    const key = parseServiceAccount(raw);
    if (typeof key === "string") throw new ValidationError(key);
    try {
      await this.engine.api.verifyKey(key);
    } catch (err) {
      throw new ValidationError(
        err instanceof PlayApiError
          ? err.message
          : "The key couldn't be checked.",
      );
    }
    const row = await this.repo.upsertConnection({
      workspaceId: actor.workspaceId,
      clientEmail: key.clientEmail,
      projectId: key.projectId,
      keyCiphertext: this.crypto.encrypt(JSON.stringify(key)),
      checkedAt: new Date(),
      createdBy: actor.userId,
    });
    await this.record(actor, "play.connected", row.id, {
      clientEmail: key.clientEmail,
    });
    return {
      id: row.id,
      clientEmail: row.clientEmail,
      projectId: row.projectId,
      status: row.status,
    };
  }

  async removeConnection(actor: PlayActor, id: string) {
    const row = await this.repo.connection(actor.workspaceId, id);
    if (!row)
      throw new NotFoundError("This Google Play connection doesn't exist.");
    await this.repo.deleteConnection(id);
    await this.record(actor, "play.disconnected", id, {
      clientEmail: row.clientEmail,
    });
  }

  private async card(app: PlayAppRow, connections: Map<string, string>) {
    const stats = await this.repo.appStats(app.id, new Date());
    const rules = await this.repo.rules(app.id);
    const enabled = rules.filter((r) => r.enabled);
    return {
      id: app.id,
      packageName: app.packageName,
      title: app.title,
      iconUrl: app.iconUrl,
      connectionId: app.connectionId,
      connectionEmail: connections.get(app.connectionId) ?? null,
      mode:
        !app.automation || !enabled.length
          ? ("off" as const)
          : enabled.some((r) => r.mode === "auto")
            ? ("auto" as const)
            : ("approval" as const),
      rating:
        stats.rating === null ? null : Math.round(stats.rating * 100) / 100,
      previousRating:
        stats.previousRating === null
          ? null
          : Math.round(stats.previousRating * 100) / 100,
      reviews30d: stats.reviews30d,
      needsReply: stats.needsReply,
      waiting: stats.waiting.pending_approval ?? 0,
      needsClaude: stats.waiting.needs_claude ?? 0,
      scheduled: stats.waiting.scheduled ?? 0,
      lastSyncedAt: app.lastSyncedAt?.toISOString() ?? null,
      syncError: app.syncError,
    };
  }

  async apps(workspaceId: string) {
    const [apps, connections] = await Promise.all([
      this.repo.apps(workspaceId),
      this.repo.connections(workspaceId),
    ]);
    const emails = new Map(connections.map((c) => [c.id, c.clientEmail]));
    return { data: await Promise.all(apps.map((a) => this.card(a, emails))) };
  }

  private async appRow(workspaceId: string, id: string) {
    const app = await this.repo.app(workspaceId, id);
    if (!app) throw new NotFoundError("This app isn't connected.");
    return app;
  }

  async app(workspaceId: string, id: string) {
    const app = await this.appRow(workspaceId, id);
    const connections = await this.repo.connections(workspaceId);
    return {
      ...(await this.card(
        app,
        new Map(connections.map((c) => [c.id, c.clientEmail])),
      )),
      automation: app.automation,
      settings: app.settings,
      variables: app.variables,
      latestVersion: app.latestVersion,
      builtInVariables: [...BUILT_IN_VARIABLES],
      suggestedVariables: [...SUGGESTED_VARIABLES],
    };
  }

  async ensurePresets(workspaceId: string) {
    const existing = new Set(
      (await this.repo.allTemplates(workspaceId)).map((t) => t.presetKey),
    );
    await this.repo.insertTemplates(
      PRESET_TEMPLATES.filter((p) => !existing.has(p.key)).map((p) => ({
        workspaceId,
        name: p.name,
        category: p.category,
        bodies: p.bodies,
        presetKey: p.key,
      })),
    );
    return this.repo.allTemplates(workspaceId);
  }

  async addApp(
    actor: PlayActor,
    input: { connectionId: string; packageName: string; title?: string },
  ) {
    const packageName = input.packageName.trim();
    if (!PACKAGE_NAME.test(packageName))
      throw new ValidationError(
        "Use the app's package name, like com.acme.shop. It's in the Play Store link after id=.",
      );
    const connection = await this.repo.connection(
      actor.workspaceId,
      input.connectionId,
    );
    if (!connection)
      throw new NotFoundError("This Google Play connection doesn't exist.");
    if (await this.repo.appByPackage(actor.workspaceId, packageName))
      throw new ValidationError(`${packageName} is already connected.`);
    const key = JSON.parse(
      this.crypto.decrypt(connection.keyCiphertext),
    ) as ServiceAccountKey;
    let listing: { title: string | null; iconUrl: string | null };
    try {
      await this.engine.api.listReviews(key, packageName, {});
      listing = await this.engine.api.listing(key, packageName);
    } catch (err) {
      throw new ValidationError(
        err instanceof PlayApiError
          ? err.message
          : "The app couldn't be reached.",
      );
    }
    const app = await this.repo.insertApp({
      workspaceId: actor.workspaceId,
      connectionId: connection.id,
      packageName,
      title: (input.title?.trim() || listing.title || packageName).slice(0, 80),
      iconUrl: listing.iconUrl,
      automation: true,
      settings: DEFAULT_SETTINGS,
      variables: {},
    });
    const templates = await this.ensurePresets(actor.workspaceId);
    const byKey = new Map(
      templates.filter((t) => t.presetKey).map((t) => [t.presetKey!, t.id]),
    );
    await this.repo.replaceRules(
      app.id,
      PRESET_RULES.filter((r) => byKey.has(r.templateKey)).map((r, i) => ({
        workspaceId: actor.workspaceId,
        appId: app.id,
        position: i,
        name: r.name,
        enabled: true,
        conditions: r.conditions,
        action: {
          type: "template" as const,
          templateId: byKey.get(r.templateKey)!,
        },
        mode: r.mode,
        delayMinutes: r.delayMinutes,
      })),
    );
    await this.record(actor, "play.app_added", app.id, { packageName });
    const sync = await this.engine
      .sync(app, { firstSync: true })
      .catch(() => null);
    return { ...(await this.app(actor.workspaceId, app.id)), firstSync: sync };
  }

  async updateApp(actor: PlayActor, id: string, input: AppUpdate) {
    const app = await this.appRow(actor.workspaceId, id);
    const values: Partial<PlayAppRow> = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title || title.length > 80)
        throw new ValidationError("The app name must be 1 to 80 characters.");
      values.title = title;
    }
    if (input.automation !== undefined) values.automation = input.automation;
    if (input.settings) {
      const given = Object.fromEntries(
        Object.entries(input.settings).filter(([, v]) => v !== undefined),
      ) as Partial<AppSettings>;
      const s = { ...app.settings, ...given };
      if (!validTimezone(s.timezone))
        throw new ValidationError(`${s.timezone} isn't a time zone.`);
      if (
        s.quietHours &&
        (!HHMM.test(s.quietHours.start) || !HHMM.test(s.quietHours.end))
      )
        throw new ValidationError("Quiet hours use 24-hour times like 22:00.");
      if (
        !Number.isInteger(s.dailyAutoLimit) ||
        s.dailyAutoLimit < 0 ||
        s.dailyAutoLimit > 500
      )
        throw new ValidationError("The daily limit must be 0 to 500.");
      s.neverAutoWords = [
        ...new Set(
          s.neverAutoWords.map((w) => w.trim().toLowerCase()).filter(Boolean),
        ),
      ];
      if (
        s.neverAutoWords.length > 100 ||
        s.neverAutoWords.some((w) => w.length > 40)
      )
        throw new ValidationError(
          "Use up to 100 words of at most 40 characters.",
        );
      if (s.translateTo && !LANG.test(s.translateTo))
        throw new ValidationError(
          "Translate to a language code like en, or leave it empty.",
        );
      values.settings = s;
    }
    if (input.variables) {
      const entries = Object.entries(input.variables)
        .map(([k, v]) => [k.trim(), String(v).trim()] as const)
        .filter(([, v]) => v);
      if (entries.length > 30)
        throw new ValidationError("Use at most 30 values.");
      for (const [k, v] of entries) {
        if (!VARIABLE_NAME.test(k))
          throw new ValidationError(
            `${k} must be lowercase letters, digits and _ and start with a letter.`,
          );
        if ((BUILT_IN_VARIABLES as readonly string[]).includes(k))
          throw new ValidationError(`{{${k}}} is filled in automatically.`);
        if (v.length > 200)
          throw new ValidationError(`{{${k}}} is longer than 200 characters.`);
      }
      values.variables = Object.fromEntries(entries);
    }
    await this.repo.updateApp(app.id, values);
    await this.record(actor, "play.app_updated", app.id, {
      fields: Object.keys(input),
    });
    return this.app(actor.workspaceId, app.id);
  }

  async removeApp(actor: PlayActor, id: string) {
    const app = await this.appRow(actor.workspaceId, id);
    await this.repo.deleteApp(app.id);
    await this.record(actor, "play.app_removed", app.id, {
      packageName: app.packageName,
    });
  }

  async syncNow(actor: PlayActor, id: string) {
    const app = await this.appRow(actor.workspaceId, id);
    return this.engine.sync(app);
  }

  private replyView(r: PlayReplyRow) {
    return {
      id: r.id,
      text: r.text,
      status: r.status,
      source: r.source,
      templateId: r.templateId,
      ruleId: r.ruleId,
      auto: r.auto,
      note: r.note,
      error: r.error,
      sendAt: r.sendAt?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
    };
  }

  private reviewView(review: PlayReviewRow, replies: PlayReplyRow[]) {
    const active = replies.find((r) =>
      ACTIVE_REPLY_STATUSES.includes(r.status),
    );
    const lastFailed = replies.find((r) => r.status === "failed");
    const replied = Boolean(review.replyText) && !review.editedAfterReply;
    const state: ReviewState = active
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
      reviewId: review.reviewId,
      authorName: review.authorName,
      stars: review.stars,
      text: review.text,
      originalText: review.originalText,
      language: review.language,
      appVersionName: review.appVersionName,
      device: review.device,
      androidVersion: review.androidVersion,
      thumbsUp: review.thumbsUp,
      reviewedAt: review.reviewedAt.toISOString(),
      reply: review.replyText
        ? {
            text: review.replyText,
            repliedAt: review.repliedAt?.toISOString() ?? null,
          }
        : null,
      editedAfterReply: review.editedAfterReply,
      starsBeforeEdit: review.starsBeforeEdit,
      state,
      draft: draft ? this.replyView(draft) : null,
    };
  }

  async reviews(
    workspaceId: string,
    appId: string,
    filters: {
      state?: ReviewState;
      stars?: number[];
      language?: string;
      version?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const app = await this.appRow(workspaceId, appId);
    const rows = await this.repo.recentReviews(app.id, filters, 2000);
    const replies = await this.repo.repliesFor(rows.map((r) => r.id));
    const byReview = new Map<string, PlayReplyRow[]>();
    for (const r of replies)
      byReview.set(r.reviewId, [...(byReview.get(r.reviewId) ?? []), r]);
    const views = rows.map((r) => this.reviewView(r, byReview.get(r.id) ?? []));
    const counts = Object.fromEntries(
      REVIEW_STATES.map((s) => [s, 0]),
    ) as Record<ReviewState, number>;
    for (const v of views) counts[v.state]++;
    const filtered = filters.state
      ? views.filter((v) => v.state === filters.state)
      : views;
    const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);
    return {
      data: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
      counts,
      languages: [
        ...new Set(
          rows.map((r) => r.language).filter((l): l is string => Boolean(l)),
        ),
      ].sort(),
      versions: [
        ...new Set(
          rows
            .map((r) => r.appVersionName)
            .filter((v): v is string => Boolean(v)),
        ),
      ]
        .sort()
        .reverse(),
    };
  }

  private async reviewFor(app: PlayAppRow, reviewId: string) {
    const review = await this.repo.review(app.workspaceId, reviewId);
    if (!review || review.appId !== app.id)
      throw new NotFoundError("This review doesn't exist.");
    return review;
  }

  private async templateFor(workspaceId: string, id: string, appId: string) {
    const template = await this.repo.template(workspaceId, id);
    if (!template || (template.appId && template.appId !== appId))
      throw new NotFoundError("This template doesn't exist.");
    return template;
  }

  async preview(
    workspaceId: string,
    appId: string,
    reviewId: string,
    templateId: string,
  ) {
    const app = await this.appRow(workspaceId, appId);
    const review = await this.reviewFor(app, reviewId);
    const template = await this.templateFor(workspaceId, templateId, app.id);
    const rendered = this.engine.renderFor(template, app, review);
    return {
      ...rendered,
      length: charCount(rendered.text),
      max: REPLY_MAX,
      note: this.engine.problemNote(rendered),
    };
  }

  private async view(app: PlayAppRow, reviewId: string) {
    const review = await this.reviewFor(app, reviewId);
    return this.reviewView(review, await this.repo.repliesFor([review.id]));
  }

  private async upsertDraft(
    actor: PlayActor,
    app: PlayAppRow,
    review: PlayReviewRow,
    input: {
      text: string;
      templateId?: string | null;
      source: PlayReplyRow["source"];
      status: PlayReplyRow["status"];
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
      workspaceId: app.workspaceId,
      appId: app.id,
      reviewId: review.id,
      createdBy: actor.userId,
    });
  }

  async replyNow(
    actor: PlayActor,
    appId: string,
    reviewId: string,
    input: {
      text: string;
      templateId?: string;
      source?: "manual" | "claude" | "template";
    },
  ) {
    const app = await this.appRow(actor.workspaceId, appId);
    const review = await this.reviewFor(app, reviewId);
    if (input.templateId)
      await this.templateFor(actor.workspaceId, input.templateId, app.id);
    const draft = await this.upsertDraft(actor, app, review, {
      text: input.text,
      templateId: input.templateId,
      source: input.source ?? (input.templateId ? "template" : "manual"),
      status: "pending_approval",
    });
    await this.engine.send(draft, actor);
    return this.view(app, review.id);
  }

  async saveDraft(
    actor: PlayActor,
    appId: string,
    reviewId: string,
    input: {
      text: string;
      templateId?: string;
      source: "manual" | "claude" | "template";
    },
  ) {
    const app = await this.appRow(actor.workspaceId, appId);
    const review = await this.reviewFor(app, reviewId);
    if (input.templateId)
      await this.templateFor(actor.workspaceId, input.templateId, app.id);
    const text = input.text.trim();
    if (!text) throw new ValidationError("Write a reply first.");
    if (charCount(text) > REPLY_MAX)
      throw new ValidationError(
        `Replies can be at most ${REPLY_MAX} characters.`,
      );
    await this.upsertDraft(actor, app, review, {
      ...input,
      status: "pending_approval",
      note: input.source === "claude" ? "Drafted by Claude." : null,
    });
    return this.view(app, review.id);
  }

  private async replyRow(workspaceId: string, id: string) {
    const reply = await this.repo.reply(workspaceId, id);
    if (!reply) throw new NotFoundError("This reply doesn't exist.");
    return reply;
  }

  async approve(actor: PlayActor, replyId: string, text?: string) {
    const reply = await this.replyRow(actor.workspaceId, replyId);
    if (
      !["pending_approval", "scheduled", "failed", "needs_claude"].includes(
        reply.status,
      )
    )
      throw new ValidationError("This reply was already sent or discarded.");
    const updated =
      text !== undefined
        ? await this.repo.updateReply(reply.id, { text: text.trim() })
        : reply;
    await this.engine.send(updated, actor);
    const app = await this.appRow(actor.workspaceId, reply.appId);
    return this.view(app, reply.reviewId);
  }

  async discard(actor: PlayActor, replyId: string) {
    const reply = await this.replyRow(actor.workspaceId, replyId);
    if (reply.status === "sent")
      throw new ValidationError(
        "This reply is already on Google Play. Edit it by sending a new reply.",
      );
    await this.repo.updateReply(reply.id, { status: "discarded" });
    const app = await this.appRow(actor.workspaceId, reply.appId);
    return this.view(app, reply.reviewId);
  }

  async bulkReply(
    actor: PlayActor,
    appId: string,
    input: { reviewIds: string[]; templateId: string },
  ) {
    const app = await this.appRow(actor.workspaceId, appId);
    const template = await this.templateFor(
      actor.workspaceId,
      input.templateId,
      app.id,
    );
    const ids = [...new Set(input.reviewIds)];
    if (!ids.length || ids.length > 50)
      throw new ValidationError("Choose 1 to 50 reviews.");
    const result = {
      sent: 0,
      held: [] as { reviewId: string; note: string }[],
      failed: [] as { reviewId: string; error: string }[],
    };
    for (const id of ids) {
      const review = await this.reviewFor(app, id);
      const rendered = this.engine.renderFor(template, app, review);
      const problem = this.engine.problemNote(rendered);
      const draft = await this.upsertDraft(actor, app, review, {
        text: rendered.text,
        templateId: template.id,
        source: "template",
        status: "pending_approval",
        note: problem,
      });
      if (problem) {
        result.held.push({ reviewId: id, note: problem });
        continue;
      }
      try {
        await this.engine.send(draft, actor);
        result.sent++;
      } catch (err) {
        result.failed.push({ reviewId: id, error: (err as Error).message });
      }
    }
    return result;
  }

  private templateView(
    t: PlayTemplateRow,
    usedBy: { id: string; name: string; appId: string }[],
    known: Record<string, string>,
  ) {
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      bodies: t.bodies,
      appId: t.appId,
      presetKey: t.presetKey,
      usedBy: usedBy.map((u) => ({
        ruleId: u.id,
        name: u.name,
        appId: u.appId,
      })),
      problems: checkTemplate(t.bodies, known),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async templates(workspaceId: string, appId?: string) {
    const app = appId ? await this.appRow(workspaceId, appId) : null;
    if (!(await this.repo.allTemplates(workspaceId)).length)
      await this.ensurePresets(workspaceId);
    const rows = await this.repo.templates(workspaceId, app?.id);
    const known = app ? this.engine.values(app, null) : {};
    return {
      data: await Promise.all(
        rows.map(async (t) =>
          this.templateView(t, await this.repo.rulesUsingTemplate(t.id), known),
        ),
      ),
      categories: [...TEMPLATE_CATEGORIES],
      builtInVariables: [...BUILT_IN_VARIABLES],
      suggestedVariables: [...SUGGESTED_VARIABLES],
    };
  }

  private cleanTemplate(input: TemplateInput) {
    const name = input.name.trim();
    if (!name || name.length > 60)
      throw new ValidationError("Template names are 1 to 60 characters.");
    if (!TEMPLATE_CATEGORIES.includes(input.category))
      throw new ValidationError("Choose a category.");
    if (!input.bodies.length || input.bodies.length > 20)
      throw new ValidationError("Add 1 to 20 languages.");
    const bodies = input.bodies.map((b) => {
      const language = b.language.trim().replace("_", "-");
      if (!LANG.test(language))
        throw new ValidationError(
          `${b.language} isn't a language code like en or pt-BR.`,
        );
      const variants = b.variants.map((v) => v.trim()).filter(Boolean);
      if (!variants.length || variants.length > 10)
        throw new ValidationError(`Add 1 to 10 wordings for ${language}.`);
      if (variants.some((v) => v.length > 1000))
        throw new ValidationError("A wording is too long.");
      return { language, variants };
    });
    return { name, category: input.category, bodies };
  }

  async createTemplate(actor: PlayActor, input: TemplateInput) {
    const clean = this.cleanTemplate(input);
    const app = input.appId
      ? await this.appRow(actor.workspaceId, input.appId)
      : null;
    const [row] = await this.repo.insertTemplates([
      { ...clean, workspaceId: actor.workspaceId, appId: app?.id ?? null },
    ]);
    await this.record(actor, "play.template_created", row!.id, {
      name: clean.name,
    });
    return this.templateView(
      row!,
      [],
      app ? this.engine.values(app, null) : {},
    );
  }

  async updateTemplate(actor: PlayActor, id: string, input: TemplateInput) {
    const template = await this.repo.template(actor.workspaceId, id);
    if (!template) throw new NotFoundError("This template doesn't exist.");
    const clean = this.cleanTemplate(input);
    const row = await this.repo.updateTemplate(id, clean);
    await this.record(actor, "play.template_updated", id, { name: clean.name });
    const app = template.appId ? await this.repo.appById(template.appId) : null;
    return this.templateView(
      row,
      await this.repo.rulesUsingTemplate(id),
      app ? this.engine.values(app, null) : {},
    );
  }

  async deleteTemplate(actor: PlayActor, id: string) {
    const template = await this.repo.template(actor.workspaceId, id);
    if (!template) throw new NotFoundError("This template doesn't exist.");
    const used = await this.repo.rulesUsingTemplate(id);
    if (used.length)
      throw new ValidationError(
        `Rules use this template: ${used.map((u) => u.name).join(", ")}. Change those rules first.`,
      );
    await this.repo.deleteTemplate(id);
    await this.record(actor, "play.template_deleted", id, {
      name: template.name,
    });
  }

  async checkDraft(
    workspaceId: string,
    input: { bodies: TemplateBody[]; appId?: string | null },
  ) {
    const app = input.appId
      ? await this.appRow(workspaceId, input.appId)
      : null;
    const known = app ? this.engine.values(app, null) : {};
    const sampleValues = { ...known, first_name: "Priya" };
    return {
      problems: checkTemplate(input.bodies, known),
      samples: input.bodies.flatMap((b) =>
        b.variants.map((variant, i) => {
          const rendered = render(variant, sampleValues);
          return {
            language: b.language,
            variant: i,
            text: rendered.text,
            length: charCount(rendered.text),
            missing: rendered.missing,
          };
        }),
      ),
    };
  }

  async restorePresets(actor: PlayActor) {
    const before = (await this.repo.allTemplates(actor.workspaceId)).length;
    const after = (await this.ensurePresets(actor.workspaceId)).length;
    return { restored: after - before };
  }

  private ruleView(r: PlayRuleRow) {
    return {
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      conditions: r.conditions,
      action: r.action,
      mode: r.mode,
      delayMinutes: r.delayMinutes,
    };
  }

  async rules(workspaceId: string, appId: string) {
    const app = await this.appRow(workspaceId, appId);
    return {
      data: (await this.repo.rules(app.id)).map((r) => this.ruleView(r)),
    };
  }

  async replaceRules(actor: PlayActor, appId: string, rules: RuleInput[]) {
    const app = await this.appRow(actor.workspaceId, appId);
    if (rules.length > 30) throw new ValidationError("Use at most 30 rules.");
    const templates = new Map(
      (await this.repo.templates(actor.workspaceId, app.id)).map((t) => [
        t.id,
        t,
      ]),
    );
    const words = (list?: string[]) => {
      const clean = [
        ...new Set(
          (list ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean),
        ),
      ];
      if (clean.length > 50 || clean.some((w) => w.length > 40))
        throw new ValidationError(
          "Use up to 50 words of at most 40 characters per list.",
        );
      return clean.length ? clean : undefined;
    };
    const rows = rules.map((r, i) => {
      const name = r.name.trim();
      if (!name || name.length > 60)
        throw new ValidationError("Rule names are 1 to 60 characters.");
      const stars = r.conditions.stars?.length
        ? [...new Set(r.conditions.stars)].sort((a, b) => a - b)
        : undefined;
      if (stars?.some((s) => !Number.isInteger(s) || s < 1 || s > 5))
        throw new ValidationError("Stars are 1 to 5.");
      const languages = r.conditions.languages
        ?.map((l) => l.trim())
        .filter(Boolean);
      if (languages?.some((l) => !LANG.test(l)))
        throw new ValidationError("Use language codes like en.");
      const versions = r.conditions.appVersions
        ?.map((v) => v.trim())
        .filter(Boolean);
      const conditions: RuleConditions = {
        ...(stars ? { stars } : {}),
        ...(words(r.conditions.keywordsAny)
          ? { keywordsAny: words(r.conditions.keywordsAny) }
          : {}),
        ...(words(r.conditions.keywordsNone)
          ? { keywordsNone: words(r.conditions.keywordsNone) }
          : {}),
        ...(languages?.length ? { languages } : {}),
        ...(versions?.length ? { appVersions: versions.slice(0, 20) } : {}),
        ...(r.conditions.edited !== undefined
          ? { edited: r.conditions.edited }
          : {}),
      };
      if (r.action.type === "template" && !templates.has(r.action.templateId))
        throw new ValidationError(`The template for "${name}" doesn't exist.`);
      if (
        !Number.isInteger(r.delayMinutes) ||
        r.delayMinutes < 0 ||
        r.delayMinutes > 1440
      )
        throw new ValidationError("Wait 0 to 1440 minutes before replying.");
      return {
        ...(r.id ? { id: r.id } : {}),
        workspaceId: actor.workspaceId,
        appId: app.id,
        position: i,
        name,
        enabled: r.enabled,
        conditions,
        action:
          r.action.type === "template"
            ? { type: "template" as const, templateId: r.action.templateId }
            : { type: r.action.type },
        mode: r.action.type === "template" ? r.mode : ("approval" as const),
        delayMinutes: r.delayMinutes,
      };
    });
    const current = new Set((await this.repo.rules(app.id)).map((r) => r.id));
    const saved = await this.repo.replaceRules(
      app.id,
      rows.map((r) =>
        "id" in r && r.id && current.has(r.id) ? r : { ...r, id: undefined },
      ),
    );
    await this.record(actor, "play.rules_saved", app.id, {
      rules: saved.length,
      auto: saved.filter((r) => r.mode === "auto").length,
    });
    return { data: saved.map((r) => this.ruleView(r)) };
  }
}
