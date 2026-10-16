import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuditService } from "@modules/audit/application/audit.service";
import { AppConfig, appUrl } from "@shared/config/app-config";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import { PlayApiError, ServiceAccountKey } from "../domain/ports/play-api";
import {
  ACTIVE_REPLY_STATUSES,
  AppSettings,
  DEFAULT_SETTINGS,
  DELAYS,
  PlayErrorKindView,
  RATING_MODES,
  RatingRule,
  REPLY_MAX,
  TONES,
  RuleAction,
  RuleConditions,
  RuleMode,
  TEMPLATE_CATEGORIES,
  TemplateBody,
  TemplateCategory,
} from "../domain/play.types";
import { computeInsights } from "../domain/insights";
import {
  dailySeries,
  distribution,
  periodStats,
  replySparkline,
} from "../domain/analytics";
import { PRESET_RULES, PRESET_TEMPLATES } from "../domain/presets";
import { keywordTopic } from "../domain/topics";
import { parseReport } from "../domain/report-csv";
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
import { PlayActor, PlayEngine, syncErrorKind } from "./play-engine.service";

const LANG = /^[a-z]{2,3}([-_][A-Za-z]{2,4})?$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ReviewState =
  | "unreplied"
  | "waiting"
  | "claude"
  | "scheduled"
  | "failed"
  | "replied"
  | "skipped";
export const REVIEW_STATES: ReviewState[] = [
  "unreplied",
  "waiting",
  "claude",
  "scheduled",
  "failed",
  "replied",
  "skipped",
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
  category?: TemplateCategory;
  ratings?: number[];
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
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  reviewsUrl(appId: string) {
    return `${appUrl(this.config)}/reviews/inbox?app=${appId}`;
  }

  async forClaude(
    workspaceId: string,
    appId: string,
    state: ReviewState | undefined,
    stars: number[] | undefined,
    limit: number,
  ) {
    const list = await this.reviews(workspaceId, appId, {
      state,
      stars,
      pageSize: limit,
    });
    return {
      total: list.total,
      counts: list.counts,
      url: this.reviewsUrl(appId),
      reviews: list.data.map((r) => ({
        review_id: r.id,
        stars: r.stars,
        author: r.authorName || "A Google user",
        text: r.text,
        ...(r.originalText ? { original_text: r.originalText } : {}),
        language: r.language,
        app_version: r.appVersionName,
        reviewed_at: r.reviewedAt,
        state: r.state,
        can_reply: r.canReply,
        ...(r.reply ? { current_reply: r.reply.text } : {}),
        ...(r.draft
          ? {
              draft: {
                text: r.draft.text,
                status: r.draft.status,
                note: r.draft.note,
              },
            }
          : {}),
        ...(r.editedAfterReply
          ? { updated_after_reply: true, stars_before: r.starsBeforeEdit }
          : {}),
      })),
    };
  }

  async reviewForClaude(workspaceId: string, appId: string, reviewId: string) {
    const app = await this.appRow(workspaceId, appId);
    const view = await this.view(app, reviewId);
    if (!view.canReply)
      throw new ValidationError(
        "This review came from a report without a review link; reply in Play Console.",
      );
    return {
      author: view.authorName || "A Google user",
      stars: view.stars,
      current_reply: view.reply?.text ?? null,
    };
  }

  async templatesForClaude(workspaceId: string, appId: string) {
    const app = await this.appRow(workspaceId, appId);
    const list = await this.templates(workspaceId, app.id);
    return {
      app: app.title,
      values: this.engine.values(app, null),
      templates: list.data.map((t) => ({
        name: t.name,
        category: t.category,
        bodies: t.bodies,
      })),
      reply_max: REPLY_MAX,
    };
  }

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
      actor: actor.userId ? "user" : "system",
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
        discoveredAt: c.discoveredAt?.toISOString() ?? null,
        discoveryError: c.discoveryError,
        apps: apps.filter((a) => a.connectionId === c.id).length,
      })),
    };
  }

  private connectError(
    stage: number,
    code: "invalid_key" | "api_disabled" | "no_permission" | "error",
    message: string,
    clientEmail?: string,
  ) {
    return new ValidationError(message, { stage, code, clientEmail });
  }

  async connect(actor: PlayActor, raw: string) {
    const key = parseServiceAccount(raw);
    if (typeof key === "string") throw this.connectError(0, "invalid_key", key);
    try {
      await this.engine.api.verifyKey(key);
    } catch (err) {
      if (err instanceof PlayApiError && err.kind === "auth")
        throw this.connectError(0, "invalid_key", err.message, key.clientEmail);
      throw this.connectError(
        0,
        "error",
        err instanceof PlayApiError
          ? err.message
          : "The key couldn't be checked.",
        key.clientEmail,
      );
    }
    const before = await this.repo.connections(actor.workspaceId);
    const isNew = !before.some((c) => c.clientEmail === key.clientEmail);
    const row = await this.repo.upsertConnection({
      workspaceId: actor.workspaceId,
      clientEmail: key.clientEmail,
      projectId: key.projectId,
      keyCiphertext: this.crypto.encrypt(JSON.stringify(key)),
      checkedAt: new Date(),
      createdBy: actor.userId,
    });
    const discovery = await this.discover(actor, row.id);
    const apps = (await this.repo.apps(actor.workspaceId)).filter(
      (a) => a.connectionId === row.id,
    );
    const fail = (
      stage: number,
      code: "api_disabled" | "no_permission",
      message: string,
    ) => this.connectError(stage, code, message, key.clientEmail);
    let problem: ValidationError | null = null;
    if (discovery.errorKind === "disabled")
      problem = fail(1, "api_disabled", discovery.error!);
    else if (
      discovery.failed.some((f) => f.kind === "disabled") &&
      !apps.length
    )
      problem = fail(
        1,
        "api_disabled",
        discovery.failed.find((f) => f.kind === "disabled")!.reason,
      );
    else if (discovery.found && !apps.length && discovery.failed.length)
      problem = fail(2, "no_permission", discovery.failed[0]!.reason);
    if (problem) {
      if (isNew) await this.repo.deleteConnection(row.id);
      throw problem;
    }
    await this.record(actor, "play.connected", row.id, {
      clientEmail: key.clientEmail,
    });
    return {
      id: row.id,
      clientEmail: row.clientEmail,
      projectId: row.projectId,
      status: row.status,
      discovery: { ...discovery, errorKind: undefined },
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
    const now = new Date();
    const stats = await this.repo.appStats(app.id, now);
    const recent = await this.repo.reviewsSince(
      app.id,
      new Date(now.getTime() - 56 * 86_400_000),
    );
    const trend = Array.from({ length: 8 }, (_, i) => {
      const to = now.getTime() - (7 - i) * 7 * 86_400_000;
      const week = recent.filter(
        (r) =>
          r.reviewedAt.getTime() > to - 7 * 86_400_000 &&
          r.reviewedAt.getTime() <= to,
      );
      return week.length
        ? Math.round(
            (week.reduce((n, r) => n + r.stars, 0) / week.length) * 100,
          ) / 100
        : null;
    });
    const ratingRules = await this.engine.ratingRules(app);
    const modes = new Set(ratingRules.map((r) => r.mode));
    const needsAccess = app.syncErrorKind === "no_permission";
    const replied = await this.repo.repliedSince(
      app.id,
      new Date(now.getTime() - 14 * 86_400_000),
    );
    return {
      id: app.id,
      packageName: app.packageName,
      title: app.title,
      iconUrl: app.iconUrl,
      connectionId: app.connectionId,
      connectionEmail: connections.get(app.connectionId) ?? null,
      enabled: app.automation,
      mode: needsAccess
        ? ("needs_access" as const)
        : modes.size === 1
          ? [...modes][0]!
          : ("mixed" as const),
      rating:
        stats.rating === null ? null : Math.round(stats.rating * 100) / 100,
      overallRating:
        stats.overall === null ? null : Math.round(stats.overall * 100) / 100,
      previousRating:
        stats.previousRating === null
          ? null
          : Math.round(stats.previousRating * 100) / 100,
      reviews30d: stats.reviews30d,
      needsReply: stats.needsReply,
      waiting: stats.waiting.pending_approval ?? 0,
      needsClaude: stats.waiting.needs_claude ?? 0,
      scheduled: stats.waiting.scheduled ?? 0,
      failed: stats.failed,
      replies14d: replySparkline(replied, now, 14),
      lastSyncedAt: app.lastSyncedAt?.toISOString() ?? null,
      syncError: app.syncError,
      syncErrorKind: app.syncErrorKind as PlayErrorKindView | null,
      pausedUntil:
        app.pausedUntil && app.pausedUntil > now
          ? app.pausedUntil.toISOString()
          : null,
      pauseReason:
        app.pausedUntil && app.pausedUntil > now ? app.pauseReason : null,
      trend,
    };
  }

  async insights(workspaceId: string, appId: string, days: number) {
    const app = await this.appRow(workspaceId, appId);
    const now = new Date();
    const reviews = await this.repo.reviewsSince(
      app.id,
      new Date(now.getTime() - 2 * days * 86_400_000),
    );
    return computeInsights({
      reviews,
      now,
      days,
      timezone: app.settings.timezone,
      appTitle: app.title,
    });
  }

  async importReport(actor: PlayActor, appId: string, file: Buffer) {
    const app = await this.appRow(actor.workspaceId, appId);
    const parsed = parseReport(file);
    if (typeof parsed === "string") throw new ValidationError(parsed);
    const other = parsed.packages.filter((p) => p !== app.packageName);
    if (other.length)
      throw new ValidationError(
        `This report is for ${other.join(", ")}, not ${app.packageName}.`,
      );
    if (!parsed.rows.length)
      throw new ValidationError("The report has no reviews.");
    const imported = await this.repo.insertReviews(
      parsed.rows.map((r) => ({
        workspaceId: app.workspaceId,
        appId: app.id,
        reviewId: r.reviewId,
        stars: r.stars,
        text: r.text,
        language: r.language,
        topic: keywordTopic(r.text, r.stars),
        appVersionName: r.appVersionName,
        appVersionCode: r.appVersionCode,
        device: r.device,
        reviewedAt: r.reviewedAt,
        replyText: r.replyText,
        repliedAt: r.repliedAt,
      })),
    );
    await this.record(actor, "play.report_imported", app.id, {
      rows: parsed.rows.length,
      imported,
    });
    const times = parsed.rows.map((r) => r.reviewedAt.getTime());
    return {
      rows: parsed.rows.length,
      imported,
      alreadyHere: parsed.rows.length - imported,
      skipped: parsed.skipped,
      ratingOnly: parsed.rows.filter((r) => !r.text).length,
      from: new Date(Math.min(...times)).toISOString(),
      to: new Date(Math.max(...times)).toISOString(),
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

  async appRow(workspaceId: string, id: string) {
    const app = await this.repo.app(workspaceId, id);
    if (!app) throw new NotFoundError("This app isn't connected.");
    return app;
  }

  async app(workspaceId: string, id: string) {
    const app = await this.appRow(workspaceId, id);
    const connections = await this.repo.connections(workspaceId);
    const card = await this.card(
      app,
      new Map(connections.map((c) => [c.id, c.clientEmail])),
    );
    const now = new Date();
    const reviews = await this.repo.reviewsSince(
      app.id,
      new Date(now.getTime() - 60 * 86_400_000),
    );
    const settings = this.engine.settingsOf(app);
    const month = reviews.filter(
      (r) => r.reviewedAt.getTime() > now.getTime() - 30 * 86_400_000,
    );
    return {
      ...card,
      automation: app.automation,
      settings,
      variables: app.variables,
      latestVersion: app.latestVersion,
      builtInVariables: [...BUILT_IN_VARIABLES],
      suggestedVariables: [...SUGGESTED_VARIABLES],
      overview: {
        ...periodStats(reviews, now.getTime() - 30 * 86_400_000, now.getTime()),
        series: dailySeries(reviews, now, 30, settings.timezone),
        distribution: distribution(month),
      },
    };
  }

  async recheck(actor: PlayActor, id: string) {
    const app = await this.appRow(actor.workspaceId, id);
    try {
      await this.engine.api.listReviews(
        await this.engine.keyFor(app),
        app.packageName,
        {},
      );
    } catch (err) {
      await this.repo.updateApp(app.id, {
        syncError:
          err instanceof PlayApiError
            ? err.message
            : "The app couldn't be reached.",
        syncErrorKind: syncErrorKind(err),
      });
      return this.app(actor.workspaceId, app.id);
    }
    await this.repo.updateApp(app.id, { syncError: null, syncErrorKind: null });
    await this.engine.sync(app).catch(() => null);
    return this.app(actor.workspaceId, app.id);
  }

  async resume(actor: PlayActor, id: string) {
    const app = await this.appRow(actor.workspaceId, id);
    await this.repo.updateApp(app.id, { pausedUntil: null, pauseReason: null });
    await this.record(actor, "play.safety_resumed", app.id);
    return this.app(actor.workspaceId, app.id);
  }

  async ensurePresets(workspaceId: string) {
    const rows = await this.repo.allTemplates(workspaceId);
    const existing = new Map(
      rows.filter((t) => t.presetKey && !t.appId).map((t) => [t.presetKey!, t]),
    );
    await this.repo.insertTemplates(
      PRESET_TEMPLATES.filter((p) => !existing.has(p.key)).map((p) => ({
        workspaceId,
        name: p.name,
        category: p.category,
        ratings: p.ratings,
        bodies: p.bodies,
        presetKey: p.key,
      })),
    );
    for (const p of PRESET_TEMPLATES) {
      const row = existing.get(p.key);
      if (
        row &&
        (row.name !== p.name ||
          JSON.stringify(row.bodies) !== JSON.stringify(p.bodies) ||
          JSON.stringify(row.ratings) !== JSON.stringify(p.ratings))
      )
        await this.repo.updateTemplate(row.id, {
          name: p.name,
          bodies: p.bodies,
          ratings: p.ratings,
          category: p.category,
        });
    }
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
    let app: PlayAppRow;
    try {
      app = await this.createApp(
        actor,
        connection.id,
        key,
        packageName,
        input.title,
      );
    } catch (err) {
      throw new ValidationError(
        err instanceof PlayApiError
          ? err.message
          : "The app couldn't be reached.",
      );
    }
    const sync = await this.engine.sync(app).catch(() => null);
    return { ...(await this.app(actor.workspaceId, app.id)), firstSync: sync };
  }

  private async createApp(
    actor: PlayActor,
    connectionId: string,
    key: ServiceAccountKey,
    packageName: string,
    title?: string | null,
  ): Promise<PlayAppRow> {
    await this.engine.api.listReviews(key, packageName, {});
    const listing = await this.engine.api.listing(key, packageName);
    const app = await this.repo.insertApp({
      workspaceId: actor.workspaceId,
      connectionId,
      packageName,
      title: (title?.trim() || listing.title || packageName).slice(0, 80),
      iconUrl: listing.iconUrl,
      automation: true,
      settings: DEFAULT_SETTINGS,
      variables: {},
    });
    const templates = await this.ensurePresets(actor.workspaceId);
    await this.engine.ratingRules(app);
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
    return app;
  }

  async discover(actor: PlayActor, connectionId: string) {
    const connection = await this.repo.connection(
      actor.workspaceId,
      connectionId,
    );
    if (!connection)
      throw new NotFoundError("This Google Play connection doesn't exist.");
    const key = JSON.parse(
      this.crypto.decrypt(connection.keyCiphertext),
    ) as ServiceAccountKey;
    const result = {
      found: 0,
      added: [] as { id: string; packageName: string; title: string }[],
      already: [] as { packageName: string; title: string }[],
      failed: [] as {
        packageName: string;
        title: string;
        reason: string;
        kind?: string;
      }[],
      error: null as string | null,
      errorKind: undefined as string | undefined,
    };
    let apps;
    try {
      apps = await this.engine.api.listApps(key);
    } catch (err) {
      result.error =
        err instanceof PlayApiError
          ? err.message
          : "Your apps couldn't be listed.";
      result.errorKind = err instanceof PlayApiError ? err.kind : undefined;
      await this.repo.updateConnection(connection.id, {
        discoveredAt: new Date(),
        discoveryError: result.error,
      });
      return result;
    }
    result.found = apps.length;
    const existing = new Map(
      (await this.repo.apps(actor.workspaceId)).map((a) => [a.packageName, a]),
    );
    const created: PlayAppRow[] = [];
    for (const found of apps) {
      const title = found.displayName ?? found.packageName;
      const have = existing.get(found.packageName);
      if (have) {
        result.already.push({
          packageName: found.packageName,
          title: have.title,
        });
        continue;
      }
      try {
        const app = await this.createApp(
          actor,
          connection.id,
          key,
          found.packageName,
          found.displayName,
        );
        created.push(app);
        result.added.push({
          id: app.id,
          packageName: app.packageName,
          title: app.title,
        });
      } catch (err) {
        result.failed.push({
          packageName: found.packageName,
          title,
          reason:
            err instanceof PlayApiError
              ? err.message
              : "This app couldn't be added.",
          kind: err instanceof PlayApiError ? err.kind : undefined,
        });
      }
    }
    for (const app of created.slice(0, 10))
      await this.engine.sync(app).catch(() => null);
    await this.repo.updateConnection(connection.id, {
      discoveredAt: new Date(),
      discoveryError: null,
    });
    if (result.added.length)
      await this.record(actor, "play.apps_discovered", connection.id, {
        added: result.added.map((a) => a.packageName),
      });
    return result;
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
      const s = { ...this.engine.settingsOf(app), ...given };
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
      if (!(s.delay in DELAYS))
        throw new ValidationError("Choose a posting delay.");
      if (!TONES.includes(s.tone)) throw new ValidationError("Choose a voice.");
      for (const k of [
        "translate",
        "personalize",
        "skipEmpty",
        "escalate",
        "autoPause",
        "replyToEdited",
      ] as const)
        if (typeof s[k] !== "boolean")
          throw new ValidationError(`${k} must be true or false.`);
      if (given.ratingRules)
        s.ratingRules = await this.cleanRatingRules(app, given.ratingRules);
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
          throw new ValidationError(`{${k}} is filled in automatically.`);
        if (v.length > 200)
          throw new ValidationError(`{${k}} is longer than 200 characters.`);
      }
      values.variables = Object.fromEntries(entries);
    }
    await this.repo.updateApp(app.id, values);
    await this.record(actor, "play.app_updated", app.id, {
      fields: Object.keys(input),
    });
    return this.app(actor.workspaceId, app.id);
  }

  private async cleanRatingRules(app: PlayAppRow, input: RatingRule[]) {
    const templates = new Set(
      (await this.repo.templates(app.workspaceId, app.id)).map((t) => t.id),
    );
    const current = await this.engine.ratingRules(app);
    return current.map((rule) => {
      const next = input.find((r) => r.rating === rule.rating);
      if (!next) return rule;
      if (!RATING_MODES.includes(next.mode))
        throw new ValidationError("Modes are auto, approval or manual.");
      if (next.templateId && !templates.has(next.templateId))
        throw new ValidationError(
          `The template for ${rule.rating}-star reviews doesn't exist.`,
        );
      return {
        rating: rule.rating,
        mode: next.mode,
        templateId: next.templateId ?? null,
      };
    });
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

  reviewView(review: PlayReviewRow, replies: PlayReplyRow[]) {
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
      canReply: !review.reviewId.startsWith("csv:"),
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

  async reviewFor(app: PlayAppRow, reviewId: string) {
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

  async view(app: PlayAppRow, reviewId: string) {
    const review = await this.reviewFor(app, reviewId);
    return this.reviewView(review, await this.repo.repliesFor([review.id]));
  }

  async upsertDraft(
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
      builtIn: Boolean(t.presetKey && !t.appId),
      ratings: t.ratings,
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
    const category = input.category ?? "custom";
    if (!TEMPLATE_CATEGORIES.includes(category))
      throw new ValidationError("Choose a category.");
    const ratings = [...new Set(input.ratings ?? [])].sort((a, b) => b - a);
    if (ratings.some((r) => !Number.isInteger(r) || r < 1 || r > 5))
      throw new ValidationError("Ratings are 1 to 5.");
    if (!input.bodies.length || input.bodies.length > 20)
      throw new ValidationError("Add 1 to 20 languages.");
    const bodies = input.bodies.map((b) => {
      const language = b.language.trim().replace("_", "-");
      if (!LANG.test(language))
        throw new ValidationError(
          `${b.language} isn't a language code like en or pt-BR.`,
        );
      const variants = b.variants.map((v) => v.trim()).filter(Boolean);
      if (!variants.length && input.bodies.length === 1)
        return { language, variants: [""] };
      if (!variants.length || variants.length > 10)
        throw new ValidationError(`Add 1 to 10 wordings for ${language}.`);
      if (variants.some((v) => v.length > 1000))
        throw new ValidationError("A wording is too long.");
      return { language, variants };
    });
    return { name, category, ratings, bodies };
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

  async duplicateTemplate(actor: PlayActor, id: string) {
    const template = await this.repo.template(actor.workspaceId, id);
    if (!template) throw new NotFoundError("This template doesn't exist.");
    const [row] = await this.repo.insertTemplates([
      {
        workspaceId: actor.workspaceId,
        appId: template.appId,
        name: `${template.name} copy`.slice(0, 60),
        category: template.category,
        ratings: template.ratings,
        bodies: template.bodies,
      },
    ]);
    await this.record(actor, "play.template_created", row!.id, {
      name: row!.name,
      from: template.id,
    });
    return this.templateView(row!, [], {});
  }

  async updateTemplate(actor: PlayActor, id: string, input: TemplateInput) {
    const template = await this.repo.template(actor.workspaceId, id);
    if (!template) throw new NotFoundError("This template doesn't exist.");
    if (template.presetKey && !template.appId)
      throw new ValidationError(
        "Pre-built templates are read-only. Duplicate it to edit.",
      );
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
    if (template.presetKey && !template.appId)
      throw new ValidationError("Pre-built templates can't be deleted.");
    const apps = (await this.repo.apps(actor.workspaceId)).filter((a) =>
      this.engine.settingsOf(a).ratingRules.some((r) => r.templateId === id),
    );
    if (apps.length)
      throw new ValidationError(
        `${apps.map((a) => a.title).join(", ")} use this template for a star rating. Pick another template there first.`,
      );
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
