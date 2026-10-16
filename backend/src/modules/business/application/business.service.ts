import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  RatingRule,
  ReplySettings,
  TemplateBody,
  TemplateCategory,
} from "@modules/engine/domain/engine.types";
import { checkTemplate } from "@modules/engine/domain/templates";
import {
  suggestFromListing,
  suggestFromReplies,
} from "@modules/engine/domain/variable-suggestions";
import { AppConfig, appUrl, webOrigins } from "@shared/config/app-config";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import {
  InfoPatch,
  METRICS,
  PostContent,
  checkInfo,
  checkPost,
  emptyMetrics,
  infoChanges,
} from "../domain/business.types";
import { BusinessApiError, GbpLocation } from "../domain/ports/business-api";
import { BUSINESS_PRESETS } from "../domain/presets";
import {
  GbpConnectionRow,
  GbpLocationRow,
  GbpPostRow,
  GbpTemplateRow,
} from "../infrastructure/business.tables";
import {
  BusinessActor,
  BusinessEngine,
  DEFAULT_BUSINESS_SETTINGS,
} from "./business-engine.service";
import {
  AnalyticsRange,
  BusinessReviewsService,
} from "./business-reviews.service";

const STATE_TTL_MS = 15 * 60_000;
const DAY = 86_400_000;

const KEY_MAP: Record<string, string> = {
  developer_name: "team_name",
  support_phone: "phone",
  support_url: "website",
  support_email: "support_email",
};

export interface LocationUpdate {
  settings?: Partial<ReplySettings>;
  variables?: Record<string, string>;
  ratingRules?: RatingRule[];
}

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  bodies: TemplateBody[];
  ratings?: number[];
  locationId?: string | null;
}

export interface PostInput {
  locationId: string;
  content: PostContent;
  when: "now" | "schedule" | "draft";
  scheduledAt?: string | null;
}

@Injectable()
export class BusinessService {
  constructor(
    private readonly engine: BusinessEngine,
    private readonly reviews: BusinessReviewsService,
    private readonly crypto: CryptoService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private origin(candidate?: string | null) {
    const allowed = [appUrl(this.config), ...webOrigins(this.config)].map((o) =>
      o.replace(/\/+$/, ""),
    );
    const clean = candidate?.replace(/\/+$/, "");
    return clean && allowed.includes(clean) ? clean : appUrl(this.config);
  }

  private redirectUri(origin = appUrl(this.config)) {
    return `${origin}/api/v1/business/oauth/callback`;
  }

  configured() {
    return Boolean(
      this.config.get("GBP_MOCK", { infer: true }) ||
      (this.config.get("GOOGLE_CLIENT_ID", { infer: true }) &&
        this.config.get("GOOGLE_CLIENT_SECRET", { infer: true })),
    );
  }

  status() {
    return {
      configured: this.configured(),
      mock: this.config.get("GBP_MOCK", { infer: true }),
      redirectUri: this.redirectUri(),
    };
  }

  connectUrl(actor: BusinessActor, from?: string) {
    if (!this.configured())
      throw new ValidationError(
        "Google sign-in isn't set up on this server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      );
    const state = Buffer.from(
      this.crypto.encrypt(
        JSON.stringify({
          w: actor.workspaceId,
          u: actor.userId,
          o: this.origin(from),
          e: Date.now() + STATE_TTL_MS,
        }),
      ),
    ).toString("base64url");
    return {
      url: this.engine.api.authUrl(this.redirectUri(this.origin(from)), state),
    };
  }

  private readState(state: string): {
    w: string;
    u: string | null;
    o: string;
  } {
    try {
      const parsed = JSON.parse(
        this.crypto.decrypt(Buffer.from(state, "base64url").toString()),
      ) as { w: string; u: string | null; o?: string; e: number };
      if (parsed.e < Date.now()) throw new Error("expired");
      return { ...parsed, o: this.origin(parsed.o) };
    } catch {
      throw new ValidationError(
        "This sign-in link expired. Start again from TreeVook.",
      );
    }
  }

  async callback(input: { code?: string; state?: string; error?: string }) {
    let origin = appUrl(this.config);
    try {
      if (input.state) origin = this.readState(input.state).o;
    } catch {
      origin = appUrl(this.config);
    }
    const base = `${origin}/business/connect`;
    if (input.error || !input.code || !input.state)
      return `${base}?error=${encodeURIComponent(
        input.error === "access_denied"
          ? "Google sign-in was cancelled."
          : "Google sign-in didn't finish. Try again.",
      )}`;
    try {
      const { w, u } = this.readState(input.state);
      const grant = await this.engine.api.exchangeCode(
        input.code,
        this.redirectUri(origin),
      );
      const connection = await this.repo.upsertConnection({
        workspaceId: w,
        email: grant.email,
        refreshTokenCiphertext: this.crypto.encrypt(grant.refreshToken),
        createdBy: u,
      });
      const actor = { userId: u, workspaceId: w, via: "app" };
      await this.ensurePresets(w);
      await this.engine.record(actor, "connected", connection.id, {
        email: grant.email,
      });
      const result = await this.discover(actor, connection.id);
      return `${origin}/business?connected=${result.added.length + result.restored.length}`;
    } catch (err) {
      const message =
        err instanceof BusinessApiError || err instanceof ValidationError
          ? err.message
          : "Google sign-in didn't finish. Try again.";
      return `${base}?error=${encodeURIComponent(message)}`;
    }
  }

  connectionView(c: GbpConnectionRow, locations: number) {
    return {
      id: c.id,
      email: c.email,
      status: c.status,
      error: c.error,
      discoveredAt: c.discoveredAt?.toISOString() ?? null,
      locations,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async connections(workspaceId: string) {
    const [rows, locations] = await Promise.all([
      this.repo.connections(workspaceId),
      this.repo.locations(workspaceId),
    ]);
    return {
      data: rows.map((c) =>
        this.connectionView(
          c,
          locations.filter((l) => l.connectionId === c.id).length,
        ),
      ),
    };
  }

  async disconnect(actor: BusinessActor, id: string) {
    const c = await this.repo.connection(actor.workspaceId, id);
    if (!c) throw new NotFoundError("This Google connection doesn't exist.");
    await this.repo.deleteConnection(c.id);
    await this.engine.record(actor, "disconnected", c.id, { email: c.email });
  }

  async ensurePresets(workspaceId: string) {
    await this.repo.insertTemplates(
      BUSINESS_PRESETS.map((p) => ({
        workspaceId,
        name: p.name,
        category: p.category,
        bodies: p.bodies,
        ratings: p.ratings,
        presetKey: p.key,
      })),
    );
  }

  private async addLocation(
    workspaceId: string,
    connection: GbpConnectionRow,
    account: string,
    l: GbpLocation,
  ) {
    const location = await this.repo.insertLocation({
      workspaceId,
      connectionId: connection.id,
      accountName: account,
      locationName: l.name,
      title: l.info.title || "Business",
      info: l.info,
      placeId: l.placeId,
      mapsUri: l.mapsUri,
      newReviewUri: l.newReviewUri,
      verified: l.verified,
      settings: DEFAULT_BUSINESS_SETTINGS,
      variables: {},
    });
    await this.engine.ratingRules(location);
    return location;
  }

  async discover(actor: BusinessActor, connectionId?: string) {
    const connections = (await this.repo.connections(actor.workspaceId)).filter(
      (c) => !connectionId || c.id === connectionId,
    );
    if (connectionId && !connections.length)
      throw new NotFoundError("This Google connection doesn't exist.");
    const result = {
      found: 0,
      added: [] as { id: string; title: string }[],
      restored: [] as { id: string; title: string }[],
      already: [] as { id: string; title: string }[],
      error: null as string | null,
    };
    for (const c of connections) {
      const token = this.engine.tokenOf(c);
      try {
        for (const account of await this.engine.api.accounts(token)) {
          for (const l of await this.engine.api.locations(
            token,
            account.name,
          )) {
            result.found++;
            const existing = await this.repo.locationByName(
              actor.workspaceId,
              l.name,
            );
            if (!existing) {
              const location = await this.addLocation(
                actor.workspaceId,
                c,
                account.name,
                l,
              );
              result.added.push({ id: location.id, title: location.title });
              await this.syncQuietly(location);
            } else if (existing.archivedAt) {
              const location = await this.repo.updateLocation(existing.id, {
                archivedAt: null,
                archiveReason: null,
                connectionId: c.id,
                syncError: null,
              });
              result.restored.push({ id: location.id, title: location.title });
              await this.syncQuietly(location);
            } else
              result.already.push({ id: existing.id, title: existing.title });
          }
        }
        await this.repo.updateConnection(c.id, {
          discoveredAt: new Date(),
          status: "active",
          error: null,
        });
      } catch (err) {
        if (!(err instanceof BusinessApiError)) throw err;
        await this.engine.failConnection(c.id, err);
        result.error = err.message;
      }
    }
    return result;
  }

  private async syncQuietly(location: GbpLocationRow) {
    try {
      await this.engine.sync(location);
      await this.prefillVariables(location.id);
      await this.engine.syncMetrics(
        (await this.repo.locationById(location.id))!,
      );
    } catch {
      return;
    }
  }

  async locationRow(workspaceId: string, id: string) {
    const location = await this.repo.location(workspaceId, id);
    if (!location) throw new NotFoundError("This business isn't connected.");
    return location;
  }

  private summaryView(
    l: GbpLocationRow,
    counts: { recent: number; open: number; waiting: number } | undefined,
    email: string | null,
  ) {
    const rules = this.engine.settingsOf(l).ratingRules;
    const modes = new Set(rules.map((r) => r.mode));
    const a = l.info.address;
    return {
      id: l.id,
      title: l.title,
      address: a ? [...a.lines, a.locality].filter(Boolean).join(", ") : null,
      category: l.info.primaryCategory,
      rating: l.averageRating,
      totalReviews: l.totalReviews,
      reviews30d: counts?.recent ?? 0,
      needsReply: counts?.open ?? 0,
      waiting: counts?.waiting ?? 0,
      mode: (modes.size === 1
        ? [...modes][0]!
        : modes.size
          ? "mixed"
          : "approval") as "auto" | "approval" | "manual" | "mixed",
      verified: l.verified,
      mapsUri: l.mapsUri,
      newReviewUri: l.newReviewUri,
      connectionId: l.connectionId,
      connectionEmail: email,
      lastSyncedAt: l.lastSyncedAt?.toISOString() ?? null,
      syncError: l.syncError,
      pausedUntil: l.pausedUntil?.toISOString() ?? null,
      pauseReason: l.pauseReason,
    };
  }

  async locations(workspaceId: string) {
    const [rows, connections] = await Promise.all([
      this.repo.locations(workspaceId),
      this.repo.connections(workspaceId),
    ]);
    const counts = await this.repo.locationCounts(
      rows.map((r) => r.id),
      new Date(Date.now() - 30 * DAY),
    );
    const emails = new Map(connections.map((c) => [c.id, c.email]));
    return {
      data: rows.map((l) =>
        this.summaryView(
          l,
          counts.get(l.id),
          emails.get(l.connectionId) ?? null,
        ),
      ),
    };
  }

  async location(workspaceId: string, id: string) {
    const l = await this.locationRow(workspaceId, id);
    const [counts, connection] = await Promise.all([
      this.repo.locationCounts([l.id], new Date(Date.now() - 30 * DAY)),
      this.repo.connectionById(l.connectionId),
    ]);
    const ratingRules = await this.engine.ratingRules(l);
    return {
      ...this.summaryView(l, counts.get(l.id), connection?.email ?? null),
      info: l.info,
      placeId: l.placeId,
      settings: { ...this.engine.settingsOf(l), ratingRules },
      variables: l.variables,
    };
  }

  async updateLocation(
    actor: BusinessActor,
    id: string,
    input: LocationUpdate,
  ) {
    const l = await this.locationRow(actor.workspaceId, id);
    const settings = { ...this.engine.settingsOf(l), ...input.settings };
    if (input.ratingRules) {
      const ids = new Set(
        (await this.repo.templates(actor.workspaceId, l.id)).map((t) => t.id),
      );
      for (const r of input.ratingRules)
        if (r.templateId && !ids.has(r.templateId))
          throw new ValidationError(
            "Pick one of your templates for each rating.",
          );
      settings.ratingRules = [5, 4, 3, 2, 1].map(
        (rating) =>
          input.ratingRules!.find((r) => r.rating === rating) ??
          settings.ratingRules.find((r) => r.rating === rating) ?? {
            rating,
            mode: "approval",
            templateId: null,
          },
      );
    }
    if (settings.dailyAutoLimit < 0 || settings.dailyAutoLimit > 500)
      throw new ValidationError("The daily limit must be between 0 and 500.");
    const variables = input.variables
      ? Object.fromEntries(
          Object.entries({ ...l.variables, ...input.variables })
            .map(([k, v]) => [k.trim(), v.trim()] as const)
            .filter(([k, v]) => /^[a-z][a-z0-9_]{0,31}$/.test(k) && v),
        )
      : l.variables;
    await this.repo.updateLocation(l.id, { settings, variables });
    await this.engine.record(actor, "location_updated", l.id, {
      fields: Object.keys(input),
    });
    return this.location(actor.workspaceId, l.id);
  }

  async previewLocation(
    workspaceId: string,
    id: string,
    input: LocationUpdate,
  ) {
    const l = await this.locationRow(workspaceId, id);
    const before = {
      ...this.engine.settingsOf(l),
      ratingRules: await this.engine.ratingRules(l),
    };
    const changes: string[] = [];
    for (const [key, value] of Object.entries(input.settings ?? {})) {
      const old = (before as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(old) !== JSON.stringify(value))
        changes.push(
          `${key}: ${JSON.stringify(old)} → ${JSON.stringify(value)}`,
        );
    }
    const names = new Map(
      (await this.repo.templates(workspaceId, l.id)).map((t) => [t.id, t.name]),
    );
    let enablesAuto = false;
    for (const r of input.ratingRules ?? []) {
      const old = before.ratingRules.find((x) => x.rating === r.rating);
      if (old && old.mode === r.mode && old.templateId === r.templateId)
        continue;
      if (r.mode === "auto" && old?.mode !== "auto") enablesAuto = true;
      changes.push(
        `${r.rating}★: ${r.mode}, ${r.templateId ? (names.get(r.templateId) ?? "unknown template") : "AI-written"}`,
      );
    }
    for (const [k, v] of Object.entries(input.variables ?? {}))
      if ((l.variables[k] ?? "") !== v)
        changes.push(`{${k}}: ${v || "(cleared)"}`);
    return { changes, enablesAuto };
  }

  async remove(actor: BusinessActor, id: string) {
    const l = await this.locationRow(actor.workspaceId, id);
    await this.repo.deleteLocation(l.id);
    await this.engine.record(actor, "location_removed", l.id, {
      title: l.title,
    });
  }

  async sync(actor: BusinessActor, id: string) {
    const l = await this.locationRow(actor.workspaceId, id);
    const result = await this.engine.sync(l);
    if (!result.archived) {
      try {
        await this.engine.syncMetrics((await this.repo.locationById(l.id))!);
      } catch {
        return result;
      }
    }
    return result;
  }

  async syncAll(actor: BusinessActor) {
    const discovery = await this.discover(actor);
    let synced = 0;
    let failed = 0;
    for (const l of await this.repo.locations(actor.workspaceId)) {
      try {
        await this.engine.sync(l);
        synced++;
      } catch {
        failed++;
      }
    }
    return {
      synced,
      failed,
      added: discovery.added.length,
      restored: discovery.restored.length,
      error: discovery.error,
    };
  }

  async variableSuggestions(workspaceId: string, id: string) {
    const l = await this.locationRow(workspaceId, id);
    const replies = await this.repo.replyTexts(l.id, 300);
    const out = new Map<
      string,
      { key: string; value: string; source: string; count: number }
    >();
    for (const s of [
      ...suggestFromListing({
        email: null,
        phone: l.info.phone,
        website: l.info.website,
      }),
      ...suggestFromReplies(replies),
    ]) {
      const key = KEY_MAP[s.key] ?? s.key;
      if (!out.has(key))
        out.set(key, {
          ...s,
          key,
          source: s.source === "play_listing" ? "business_profile" : s.source,
        });
    }
    return {
      data: [...out.values()].map((s) => ({
        ...s,
        current: l.variables[s.key] ?? null,
      })),
    };
  }

  async prefillVariables(id: string) {
    const l = await this.repo.locationById(id);
    if (!l) return;
    const { data } = await this.variableSuggestions(l.workspaceId, id);
    const fill = Object.fromEntries(
      data.filter((s) => !l.variables[s.key]).map((s) => [s.key, s.value]),
    );
    if (Object.keys(fill).length)
      await this.repo.updateLocation(l.id, {
        variables: { ...fill, ...l.variables },
      });
  }

  templateView(t: GbpTemplateRow) {
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      bodies: t.bodies,
      ratings: t.ratings,
      hidden: t.hidden,
      preset: Boolean(t.presetKey),
      locationId: t.locationId,
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async templates(workspaceId: string, locationId?: string) {
    await this.ensurePresets(workspaceId);
    return {
      data: (await this.repo.templates(workspaceId, locationId)).map((t) =>
        this.templateView(t),
      ),
    };
  }

  private async checkTemplateInput(workspaceId: string, input: TemplateInput) {
    if (!input.name.trim()) throw new ValidationError("Name the template.");
    if (!input.bodies.length)
      throw new ValidationError("Add at least one wording.");
    let known: Record<string, string> = {
      business_name: "x",
      phone: "x",
      website: "x",
    };
    if (input.locationId) {
      const l = await this.locationRow(workspaceId, input.locationId);
      known = { ...known, ...l.variables };
    }
    const problems = checkTemplate(
      input.bodies,
      known,
      "google_business",
    ).filter((p) => !/no value in this app's settings/.test(p.problem));
    if (problems.length)
      throw new ValidationError(problems.map((p) => p.problem).join(" "));
  }

  async createTemplate(actor: BusinessActor, input: TemplateInput) {
    await this.checkTemplateInput(actor.workspaceId, input);
    const [row] = await this.repo.insertTemplates([
      {
        workspaceId: actor.workspaceId,
        locationId: input.locationId ?? null,
        name: input.name.trim(),
        category: input.category,
        bodies: input.bodies,
        ratings: input.ratings ?? [],
      },
    ]);
    await this.engine.record(actor, "template_created", row!.id, {
      name: row!.name,
    });
    return this.templateView(row!);
  }

  async updateTemplate(actor: BusinessActor, id: string, input: TemplateInput) {
    const t = await this.repo.template(actor.workspaceId, id);
    if (!t) throw new NotFoundError("This template doesn't exist.");
    await this.checkTemplateInput(actor.workspaceId, input);
    const row = await this.repo.updateTemplate(t.id, {
      name: input.name.trim(),
      category: input.category,
      bodies: input.bodies,
      ratings: input.ratings ?? t.ratings,
      locationId:
        input.locationId === undefined ? t.locationId : input.locationId,
    });
    return this.templateView(row);
  }

  async setTemplateHidden(actor: BusinessActor, id: string, hidden: boolean) {
    const t = await this.repo.template(actor.workspaceId, id);
    if (!t) throw new NotFoundError("This template doesn't exist.");
    return this.templateView(await this.repo.updateTemplate(t.id, { hidden }));
  }

  async deleteTemplate(actor: BusinessActor, id: string) {
    const t = await this.repo.template(actor.workspaceId, id);
    if (!t) throw new NotFoundError("This template doesn't exist.");
    if (t.presetKey)
      throw new ValidationError(
        "Built-in templates can't be deleted. Hide it instead.",
      );
    for (const l of await this.repo.locations(actor.workspaceId)) {
      const settings = this.engine.settingsOf(l);
      if (settings.ratingRules.some((r) => r.templateId === t.id))
        await this.repo.updateLocation(l.id, {
          settings: {
            ...settings,
            ratingRules: settings.ratingRules.map((r) =>
              r.templateId === t.id ? { ...r, templateId: null } : r,
            ),
          },
        });
    }
    await this.repo.deleteTemplate(t.id);
    await this.engine.record(actor, "template_deleted", t.id, { name: t.name });
  }

  postView(p: GbpPostRow) {
    return {
      id: p.id,
      locationId: p.locationId,
      type: p.type,
      content: p.content,
      status: p.status,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      searchUrl: p.searchUrl,
      error: p.error,
      source: p.source,
      createdAt: p.createdAt.toISOString(),
    };
  }

  async posts(workspaceId: string, locationId?: string) {
    const ids = locationId
      ? [(await this.locationRow(workspaceId, locationId)).id]
      : (await this.repo.locations(workspaceId)).map((l) => l.id);
    return {
      data: (await this.repo.posts(workspaceId, ids, 300)).map((p) =>
        this.postView(p),
      ),
    };
  }

  private normalizePost(content: PostContent): PostContent {
    return {
      type: content.type,
      summary: content.summary.trim(),
      mediaUrl: content.mediaUrl?.trim() || null,
      cta: content.cta
        ? { type: content.cta.type, url: content.cta.url?.trim() || null }
        : null,
      event: content.type === "STANDARD" ? null : content.event,
      offer: content.type === "OFFER" ? content.offer : null,
    };
  }

  private when(input: PostInput) {
    if (input.when !== "schedule") return null;
    const at = Date.parse(input.scheduledAt ?? "");
    if (Number.isNaN(at))
      throw new ValidationError("Choose when to publish the post.");
    if (at < Date.now() + 60_000)
      throw new ValidationError("Schedule the post at least a minute ahead.");
    if (at > Date.now() + 365 * DAY)
      throw new ValidationError("Schedule the post within a year.");
    return new Date(at);
  }

  async createPost(actor: BusinessActor, input: PostInput) {
    const l = await this.locationRow(actor.workspaceId, input.locationId);
    const content = this.normalizePost(input.content);
    const problems = checkPost(content);
    if (problems.length && input.when !== "draft")
      throw new ValidationError(problems.join(" "));
    const scheduledAt = this.when(input);
    const row = await this.repo.insertPost({
      workspaceId: actor.workspaceId,
      locationId: l.id,
      type: content.type,
      content,
      status: input.when === "schedule" ? "scheduled" : "draft",
      scheduledAt,
      source: actor.via,
      createdBy: actor.userId,
    });
    await this.engine.record(actor, "post_created", row.id, {
      location: l.id,
      when: input.when,
    });
    if (input.when === "now")
      return this.postView(await this.engine.publish(row, actor));
    return this.postView(row);
  }

  async updatePost(
    actor: BusinessActor,
    id: string,
    input: Omit<PostInput, "locationId">,
  ) {
    const post = await this.repo.post(actor.workspaceId, id);
    if (!post) throw new NotFoundError("This post doesn't exist.");
    if (post.status === "published")
      throw new ValidationError(
        "Published posts can't be edited on Google. Delete it and post again.",
      );
    const content = this.normalizePost(input.content);
    const problems = checkPost(content);
    if (problems.length && input.when !== "draft")
      throw new ValidationError(problems.join(" "));
    const scheduledAt = this.when({ ...input, locationId: post.locationId });
    const row = await this.repo.updatePost(post.id, {
      type: content.type,
      content,
      status: input.when === "schedule" ? "scheduled" : "draft",
      scheduledAt,
      error: null,
    });
    if (input.when === "now")
      return this.postView(await this.engine.publish(row, actor));
    return this.postView(row);
  }

  async deletePost(actor: BusinessActor, id: string) {
    const post = await this.repo.post(actor.workspaceId, id);
    if (!post) throw new NotFoundError("This post doesn't exist.");
    if (post.googleName) {
      const l = await this.repo.locationById(post.locationId);
      if (l)
        try {
          await this.engine.api.deletePost(
            await this.engine.tokenFor(l),
            post.googleName,
          );
        } catch (err) {
          if (!(err instanceof BusinessApiError) || err.kind !== "not_found")
            throw err instanceof BusinessApiError
              ? new ValidationError(err.message)
              : err;
        }
    }
    await this.repo.deletePost(post.id);
    await this.engine.record(actor, "post_deleted", post.id, {
      location: post.locationId,
    });
  }

  async info(workspaceId: string, id: string) {
    const l = await this.locationRow(workspaceId, id);
    return {
      info: l.info,
      mapsUri: l.mapsUri,
      newReviewUri: l.newReviewUri,
      verified: l.verified,
    };
  }

  async previewInfo(workspaceId: string, id: string, patch: InfoPatch) {
    const l = await this.locationRow(workspaceId, id);
    const problems = checkInfo(patch);
    return { changes: infoChanges(l.info, patch), problems };
  }

  async updateInfo(actor: BusinessActor, id: string, patch: InfoPatch) {
    const l = await this.locationRow(actor.workspaceId, id);
    const problems = checkInfo(patch);
    if (problems.length) throw new ValidationError(problems.join(" "));
    const changes = infoChanges(l.info, patch);
    if (!changes.length) return this.info(actor.workspaceId, id);
    let fresh: GbpLocation;
    try {
      fresh = await this.engine.api.updateLocation(
        await this.engine.tokenFor(l),
        l.locationName,
        patch,
      );
    } catch (err) {
      await this.engine.failConnection(l.connectionId, err);
      throw err instanceof BusinessApiError
        ? new ValidationError(err.message)
        : err;
    }
    await this.repo.updateLocation(l.id, {
      info: fresh.info,
      title: fresh.info.title || l.title,
    });
    await this.engine.record(actor, "info_updated", l.id, { changes });
    return this.info(actor.workspaceId, id);
  }

  async insights(
    workspaceId: string,
    locationId: string | undefined,
    range: AnalyticsRange,
  ) {
    const locations = locationId
      ? [await this.locationRow(workspaceId, locationId)]
      : await this.repo.locations(workspaceId);
    const ids = locations.map((l) => l.id);
    const timezone = locations[0]
      ? this.engine.settingsOf(locations[0]).timezone
      : "Asia/Kolkata";
    const now = new Date();
    const { start, end } = await this.reviews.window(
      workspaceId,
      ids,
      range,
      timezone,
      now,
    );
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    const days = Math.max(1, Math.ceil((end - start) / DAY));
    const rows = await this.repo.metrics(
      ids,
      iso(start - days * DAY),
      iso(end),
    );
    const byDay = new Map<string, ReturnType<typeof emptyMetrics>>();
    for (const r of rows) {
      const day = byDay.get(r.day) ?? emptyMetrics();
      for (const k of METRICS) day[k] += r.values[k] ?? 0;
      byDay.set(r.day, day);
    }
    const sum = (from: number, to: number) => {
      const total = emptyMetrics();
      for (const [day, v] of byDay) {
        const t = Date.parse(`${day}T00:00:00Z`);
        if (t >= from && t < to) for (const k of METRICS) total[k] += v[k];
      }
      return total;
    };
    const series = [];
    for (let t = Date.parse(`${iso(start)}T00:00:00Z`); t <= end; t += DAY) {
      const day = iso(t);
      series.push({ day, ...(byDay.get(day) ?? emptyMetrics()) });
    }
    const lastDay = rows.at(-1)?.day ?? null;
    return {
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
      days,
      current: sum(Date.parse(`${iso(start)}T00:00:00Z`), end + 1),
      previous: sum(
        Date.parse(`${iso(start - days * DAY)}T00:00:00Z`),
        Date.parse(`${iso(start)}T00:00:00Z`),
      ),
      series,
      lastDay,
      note: "Google publishes profile numbers with a 2–3 day delay.",
    };
  }

  async dashboard(workspaceId: string) {
    const [locations, inbox, posts] = await Promise.all([
      this.locations(workspaceId),
      this.reviews.inbox(workspaceId, "pending", undefined, undefined, 5),
      this.posts(workspaceId),
    ]);
    return {
      locations: locations.data.length,
      needsReply: inbox.counts.pending,
      scheduledPosts: posts.data.filter((p) => p.status === "scheduled").length,
      publishedPosts30d: posts.data.filter(
        (p) =>
          p.publishedAt && Date.parse(p.publishedAt) > Date.now() - 30 * DAY,
      ).length,
    };
  }
}
