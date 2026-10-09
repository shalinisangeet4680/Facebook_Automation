import { Inject, Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
import { SettingsService } from "@modules/settings/application/settings.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { AssetView } from "@modules/meta/domain/meta.types";
import {
  AdObject,
  AdStatus,
  META_ADS,
  MetaAds,
  TargetingSearchType,
} from "@modules/meta/domain/ports/meta-ads";
import { CacheService } from "@shared/cache/cache.service";
import { CodedError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";
import { CryptoService } from "@shared/security/crypto.service";

import {
  AdsActor,
  ConfirmationRequired,
  DraftInput,
  PerformanceInput,
  TargetingInput,
} from "../domain/ads.types";
import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOALS,
  resultFor,
} from "../domain/goals";
import { formatMoney, toMajor, toMinor } from "../domain/money";
import {
  CONFIRM_TTL_SECONDS,
  ConfirmationService,
} from "./confirmation.service";

const DAY_SECONDS = 86_400;
const DRAFT_DEDUPE_SECONDS = 600;

export interface DraftResult {
  status: "created_paused";
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  dailyBudget: number;
  currency: string;
  adsManagerUrl: string;
  next: string;
  duplicate?: boolean;
}

const text = (v: unknown, fallback: string): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : fallback;

const rejected = (code: ErrorCode, message: string) =>
  new CodedError(code, 422, message);

export interface Workspace {
  token: string;
  adAccount: AssetView;
  currency: string;
  page: AssetView | null;
  instagram: AssetView | null;
  dataset: AssetView | null;
  business: AssetView | null;
}

@Injectable()
export class AdsService {
  constructor(
    private readonly connections: MetaConnectionService,
    @Inject(META_ADS) private readonly ads: MetaAds,
    private readonly confirmations: ConfirmationService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly crypto: CryptoService,
    private readonly settings: SettingsService,
  ) {}

  async overview(workspaceId: string) {
    const view = await this.connections.view(workspaceId);
    const primary = (kind: AssetView["kind"]) =>
      view.assets.find((a) => a.kind === kind && a.isPrimary) ?? null;
    const account = primary("ad_account");
    const currency = text(account?.details.currency, "INR");
    const minor = (v: unknown) =>
      v === null || v === undefined ? null : toMajor(Number(v), currency);
    return {
      connection: {
        status: view.status,
        systemUser: view.systemUser?.name ?? null,
        checkedAt: view.checkedAt,
        warnings: view.checks
          .filter((c) => c.status !== "passed")
          .map((c) => c.message),
      },
      business: primary("business")?.name ?? null,
      adAccount: account
        ? {
            id: account.externalId,
            name: account.name,
            currency,
            timezone: account.details.timezone ?? null,
            active: account.details.status === 1,
            amountSpent: minor(account.details.amountSpent),
            spendCap: minor(account.details.spendCap),
          }
        : null,
      facebookPage: primary("page")?.name ?? null,
      instagram: primary("instagram")?.name ?? null,
      pixel: primary("dataset")
        ? { id: primary("dataset")!.externalId, name: primary("dataset")!.name }
        : null,
      guardrails: {
        maxDailyBudget: (await this.settings.targets(workspaceId))
          .maxDailyBudget,
        newCampaignsStartPaused: true,
        launchAndBudgetChangesNeedConfirmation: true,
      },
    };
  }

  async performance(workspaceId: string, input: PerformanceInput) {
    const ws = await this.workspace(workspaceId);
    const rows = await this.ads.insights(ws.token, ws.adAccount.externalId, {
      level: input.level,
      datePreset: input.datePreset,
      since: input.since,
      until: input.until,
      daily: input.daily ?? false,
      campaignId: input.campaignId,
      limit: Math.min(input.limit ?? 50, 200),
    });
    const totals = { spend: 0, impressions: 0, linkClicks: 0, results: 0 };
    const data = rows.map((r) => {
      const result = resultFor(r.objective, r.actions);
      totals.spend += r.spend;
      totals.impressions += r.impressions;
      totals.linkClicks += r.linkClicks;
      totals.results += result?.count ?? 0;
      return {
        id: r.id,
        name: r.name,
        objective: r.objective,
        from: r.dateStart,
        to: r.dateStop,
        spend: r.spend,
        impressions: r.impressions,
        reach: r.reach,
        frequency: r.frequency,
        linkClicks: r.linkClicks,
        ctrPercent: r.ctr,
        cpc: r.cpc,
        cpm: r.cpm,
        result: result ? { type: result.action, count: result.count } : null,
        costPerResult: result
          ? Math.round((r.spend / result.count) * 100) / 100
          : null,
        actions: Object.fromEntries(
          Object.entries(r.actions)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 12),
        ),
      };
    });
    return {
      currency: ws.currency,
      level: input.level,
      period:
        input.since && input.until
          ? `${input.since} to ${input.until}`
          : (input.datePreset ?? "last_7d"),
      rows: data,
      totals: {
        spend: Math.round(totals.spend * 100) / 100,
        impressions: totals.impressions,
        linkClicks: totals.linkClicks,
        results: totals.results,
      },
      note: data.length ? undefined : "No delivery in this period.",
    };
  }

  async campaigns(workspaceId: string, status: "active" | "paused" | "all") {
    const ws = await this.workspace(workspaceId);
    const rows = await this.ads.campaigns(ws.token, ws.adAccount.externalId);
    const filtered = rows.filter((c) =>
      status === "all"
        ? c.status !== "DELETED" && c.status !== "ARCHIVED"
        : c.status === status.toUpperCase(),
    );
    return {
      currency: ws.currency,
      campaigns: filtered.map((c) => ({
        id: c.id,
        name: c.name,
        objective: c.objective,
        status: c.status,
        deliveryStatus: c.effectiveStatus,
        dailyBudget: toMajor(c.dailyBudget, ws.currency),
        lifetimeBudget: toMajor(c.lifetimeBudget, ws.currency),
        startTime: c.startTime,
        stopTime: c.stopTime,
      })),
    };
  }

  async campaign(workspaceId: string, campaignId: string) {
    const ws = await this.workspace(workspaceId);
    await this.owned(ws, campaignId);
    const detail = await this.ads.campaign(ws.token, campaignId);
    const money = (v: number | null) => toMajor(v, ws.currency);
    return {
      currency: ws.currency,
      campaign: {
        ...detail.campaign,
        dailyBudget: money(detail.campaign.dailyBudget),
        lifetimeBudget: money(detail.campaign.lifetimeBudget),
      },
      adSets: detail.adSets.map((s) => ({
        ...s,
        dailyBudget: money(s.dailyBudget),
        lifetimeBudget: money(s.lifetimeBudget),
      })),
      ads: detail.ads,
      adsManagerUrl: this.adsManagerUrl(ws, campaignId),
    };
  }

  async tracking(workspaceId: string) {
    const ws = await this.workspace(workspaceId);
    if (!ws.dataset) {
      return {
        pixel: null,
        warnings: [
          "No Pixel (dataset) is selected. Conversion campaigns need one.",
        ],
      };
    }
    const now = Math.floor(Date.now() / 1000);
    const [day, week] = await Promise.all([
      this.ads.pixelEvents(ws.token, ws.dataset.externalId, now - DAY_SECONDS),
      this.ads.pixelEvents(
        ws.token,
        ws.dataset.externalId,
        now - 7 * DAY_SECONDS,
      ),
    ]);
    const warnings: string[] = [];
    if (!day.length)
      warnings.push(
        "The Pixel hasn't received any events in the last 24 hours.",
      );
    const conversions = [
      "Lead",
      "Purchase",
      "CompleteRegistration",
      "Contact",
      "Schedule",
      "StartTrial",
      "Subscribe",
    ];
    if (!week.some((e) => conversions.includes(e.event))) {
      warnings.push(
        "No conversion events (Lead, Purchase, CompleteRegistration…) in the last 7 days.",
      );
    }
    return {
      pixel: {
        id: ws.dataset.externalId,
        name: ws.dataset.name,
        lastFiredTime: ws.dataset.details.lastFiredTime ?? null,
      },
      last24Hours: day,
      last7Days: week,
      warnings,
    };
  }

  async searchTargeting(
    workspaceId: string,
    type: TargetingSearchType,
    query: string,
    countryCode?: string,
  ) {
    const ws = await this.workspace(workspaceId);
    return {
      results: await this.ads.searchTargeting(
        ws.token,
        ws.adAccount.externalId,
        type,
        query,
        countryCode ?? null,
      ),
    };
  }

  async createDraft(actor: AdsActor, input: DraftInput) {
    const ws = await this.workspace(actor.workspaceId);
    await this.assertBudget(input.dailyBudget, ws.currency, actor.workspaceId);
    if (!ws.page)
      throw rejected(
        ErrorCode.META_ASSETS_MISSING,
        "Select a Facebook Page before creating ads.",
      );
    const goal = GOALS[input.goal];
    if (goal.needsPixel && !ws.dataset) {
      throw rejected(
        ErrorCode.META_ASSETS_MISSING,
        "This goal needs a Pixel. Select one in Setup first.",
      );
    }
    const post = input.creative.post ?? null;
    if (post?.platform === "instagram" && !ws.instagram) {
      throw rejected(
        ErrorCode.META_ASSETS_MISSING,
        "No Instagram account is connected, so an Instagram post can't be used.",
      );
    }
    if (!post && !input.creative.imageUrl && !input.creative.imageHash) {
      throw rejected(
        ErrorCode.VALIDATION,
        "Add an image: pass image_url (a public https link) or image_hash.",
      );
    }

    const dedupeKey = `ads:draft:${actor.workspaceId}:${this.crypto.hash(JSON.stringify(input))}`;
    const previous = await this.cache.get<DraftResult>(dedupeKey);
    if (previous) return { ...previous, duplicate: true };

    const event =
      input.conversionEvent ?? (input.goal === "sales" ? "PURCHASE" : "LEAD");
    const result = await this.ads.createDraft(ws.token, {
      adAccountId: ws.adAccount.externalId,
      name: input.name,
      objective: goal.objective,
      dailyBudget: toMinor(input.dailyBudget, ws.currency),
      adSet: {
        optimizationGoal: goal.optimizationGoal,
        billingEvent: "IMPRESSIONS",
        destinationType: goal.destinationType,
        promotedObject: goal.needsPixel
          ? { pixel_id: ws.dataset!.externalId, custom_event_type: event }
          : null,
        targeting: this.targeting(input.targeting),
      },
      creative: {
        pageId: ws.page.externalId,
        instagramId: ws.instagram?.externalId ?? null,
        message: input.creative.primaryText,
        headline: input.creative.headline,
        description: input.creative.description ?? null,
        link: input.creative.linkUrl,
        imageUrl: input.creative.imageUrl ?? null,
        imageHash: input.creative.imageHash ?? null,
        existingPost: post,
        callToAction: input.creative.callToAction,
      },
    });

    await this.record(actor, "ads.draft_created", result.campaignId, {
      name: input.name,
      goal: input.goal,
      dailyBudget: input.dailyBudget,
      currency: ws.currency,
      ...result,
    });
    const response: DraftResult = {
      status: "created_paused",
      ...result,
      dailyBudget: input.dailyBudget,
      currency: ws.currency,
      adsManagerUrl: this.adsManagerUrl(ws, result.campaignId),
      next: "Everything is paused. Review it in Ads Manager, then call activate with the campaign id when the user wants it live.",
    };
    await this.cache.set(dedupeKey, response, DRAFT_DEDUPE_SECONDS);
    return response;
  }

  async pause(actor: AdsActor, id: string) {
    const ws = await this.workspace(actor.workspaceId);
    const object = await this.owned(ws, id);
    if (object.status === "PAUSED") {
      return {
        status: "already_paused",
        id,
        type: object.type,
        name: object.name,
      };
    }
    await this.ads.setStatus(ws.token, id, "PAUSED");
    await this.record(actor, "ads.paused", id, {
      type: object.type,
      name: object.name,
    });
    return { status: "paused", id, type: object.type, name: object.name };
  }

  async launchNow(actor: AdsActor, campaignId: string) {
    const ws = await this.workspace(actor.workspaceId);
    const object = await this.owned(ws, campaignId);
    const children = await this.pausedChildren(ws, object);
    const targets = [
      ...(object.status === "PAUSED"
        ? [{ id: object.id, type: object.type, name: object.name }]
        : []),
      ...children,
    ];
    for (const target of [...targets].reverse()) {
      await this.ads.setStatus(ws.token, target.id, "ACTIVE");
    }
    await this.record(actor, "ads.activated", campaignId, {
      type: object.type,
      name: object.name,
      targets: targets.map((t) => t.id),
    });
    return { activated: targets };
  }

  async planningContext(workspaceId: string) {
    const [overview, history, tracking] = await Promise.all([
      this.overview(workspaceId),
      this.performance(workspaceId, {
        level: "campaign",
        datePreset: "last_90d",
        limit: 50,
      }),
      this.tracking(workspaceId),
    ]);
    const campaigns = await this.campaigns(workspaceId, "all");
    return {
      account: overview,
      campaigns: campaigns.campaigns,
      last90Days: { totals: history.totals, byCampaign: history.rows },
      tracking,
      options: {
        goals: Object.entries(GOALS).map(([name, g]) => ({
          name,
          metaObjective: g.objective,
          needsPixel: g.needsPixel,
        })),
        conversionEvents: CONVERSION_EVENTS,
        callsToAction: CALLS_TO_ACTION,
        maxDailyBudget: (await this.settings.targets(workspaceId))
          .maxDailyBudget,
        currency: overview.adAccount?.currency ?? "INR",
      },
    };
  }

  async activate(
    actor: AdsActor,
    id: string,
    includeChildren: boolean,
    confirmToken?: string,
  ): Promise<ConfirmationRequired | Record<string, unknown>> {
    const ws = await this.workspace(actor.workspaceId);
    const object = await this.owned(ws, id);
    const children = includeChildren
      ? await this.pausedChildren(ws, object)
      : [];
    const targets = [
      ...(object.status === "PAUSED"
        ? [{ id: object.id, type: object.type, name: object.name }]
        : []),
      ...children,
    ];
    if (!targets.length) {
      return {
        status: "already_active",
        id,
        type: object.type,
        name: object.name,
      };
    }
    const args = { id, targets: targets.map((t) => t.id) };
    if (!confirmToken) {
      const budget = await this.budgetLine(ws, object);
      return this.requireConfirmation(
        actor.workspaceId,
        "activate",
        args,
        [
          `Turn ON ${object.type} "${object.name}" (${id}).`,
          ...children.map((c) => `Also turn on ${c.type} "${c.name}".`),
          budget,
          "Meta will start spending money as soon as this is live.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    await this.confirm(actor.workspaceId, "activate", args, confirmToken);
    for (const target of [...targets].reverse()) {
      await this.ads.setStatus(
        ws.token,
        target.id,
        "ACTIVE" satisfies AdStatus,
      );
    }
    await this.record(actor, "ads.activated", id, {
      type: object.type,
      name: object.name,
      targets: args.targets,
    });
    return {
      status: "active",
      id,
      type: object.type,
      name: object.name,
      activated: targets,
    };
  }

  async updateDailyBudget(
    actor: AdsActor,
    id: string,
    dailyBudget: number,
    confirmToken?: string,
  ): Promise<ConfirmationRequired | Record<string, unknown>> {
    const ws = await this.workspace(actor.workspaceId);
    const object = await this.owned(ws, id);
    if (object.type === "ad" || object.dailyBudget === null) {
      throw rejected(
        ErrorCode.VALIDATION,
        object.type === "ad"
          ? "Ads don't have budgets. Change the budget of the ad set or campaign."
          : `This ${object.type} doesn't use a daily budget. Change the budget where it is set (campaign or ad set).`,
      );
    }
    await this.assertBudget(dailyBudget, ws.currency, actor.workspaceId);
    const current = toMajor(object.dailyBudget, ws.currency)!;
    const args = { id, dailyBudget };
    if (!confirmToken) {
      const change = current
        ? Math.round(((dailyBudget - current) / current) * 100)
        : 0;
      return this.requireConfirmation(
        actor.workspaceId,
        "update_daily_budget",
        args,
        `Change the daily budget of ${object.type} "${object.name}" from ${formatMoney(current, ws.currency)} to ${formatMoney(dailyBudget, ws.currency)} (${change >= 0 ? "+" : ""}${change}%).`,
      );
    }
    await this.confirm(
      actor.workspaceId,
      "update_daily_budget",
      args,
      confirmToken,
    );
    await this.ads.setDailyBudget(
      ws.token,
      id,
      toMinor(dailyBudget, ws.currency),
    );
    await this.record(actor, "ads.budget_changed", id, {
      type: object.type,
      name: object.name,
      from: current,
      to: dailyBudget,
      currency: ws.currency,
    });
    return {
      status: "updated",
      id,
      type: object.type,
      name: object.name,
      from: current,
      to: dailyBudget,
      currency: ws.currency,
    };
  }

  account(workspaceId: string): Promise<Workspace> {
    return this.workspace(workspaceId);
  }

  private async workspace(workspaceId: string): Promise<Workspace> {
    const token = await this.connections.accessToken(workspaceId);
    const { data } = await this.connections.listAssets(workspaceId);
    const primary = (kind: AssetView["kind"]) =>
      data.find((a) => a.kind === kind && a.isPrimary) ?? null;
    const adAccount = primary("ad_account");
    if (!adAccount) {
      throw rejected(
        ErrorCode.META_ASSETS_MISSING,
        "Select an ad account in Setup first.",
      );
    }
    return {
      token,
      adAccount,
      currency: text(adAccount.details.currency, "INR"),
      page: primary("page"),
      instagram: primary("instagram"),
      dataset: primary("dataset"),
      business: primary("business"),
    };
  }

  private async owned(ws: Workspace, id: string): Promise<AdObject> {
    const object = await this.ads.object(ws.token, id);
    if (object.accountId !== ws.adAccount.externalId) {
      throw new CodedError(
        ErrorCode.NOT_FOUND,
        404,
        "That campaign, ad set or ad isn't in your selected ad account.",
      );
    }
    return object;
  }

  private async pausedChildren(ws: Workspace, object: AdObject) {
    if (object.type === "ad" || !object.campaignId) return [];
    const detail = await this.ads.campaign(ws.token, object.campaignId);
    if (object.type === "adset") {
      return detail.ads
        .filter((a) => a.adSetId === object.id && a.status === "PAUSED")
        .map((a) => ({ id: a.id, type: "ad" as const, name: a.name }));
    }
    return [
      ...detail.adSets
        .filter((s) => s.status === "PAUSED")
        .map((s) => ({ id: s.id, type: "adset" as const, name: s.name })),
      ...detail.ads
        .filter((a) => a.status === "PAUSED")
        .map((a) => ({ id: a.id, type: "ad" as const, name: a.name })),
    ];
  }

  private async budgetLine(
    ws: Workspace,
    object: AdObject,
  ): Promise<string | null> {
    if (object.dailyBudget) {
      return `Daily budget: ${formatMoney(toMajor(object.dailyBudget, ws.currency)!, ws.currency)}.`;
    }
    if (object.type !== "campaign") return null;
    const detail = await this.ads.campaign(ws.token, object.id);
    const total = detail.adSets.reduce(
      (sum, s) => sum + (s.dailyBudget ?? 0),
      0,
    );
    return total
      ? `Daily budget across ad sets: ${formatMoney(toMajor(total, ws.currency)!, ws.currency)}.`
      : null;
  }

  private async requireConfirmation(
    workspaceId: string,
    action: string,
    args: unknown,
    summary: string,
  ): Promise<ConfirmationRequired> {
    return {
      status: "confirmation_required",
      summary,
      confirmToken: await this.confirmations.issue(workspaceId, action, args),
      expiresInSeconds: CONFIRM_TTL_SECONDS,
    };
  }

  private async confirm(
    workspaceId: string,
    action: string,
    args: unknown,
    token: string,
  ) {
    const ok = await this.confirmations.consume(
      workspaceId,
      action,
      args,
      token,
    );
    if (!ok) {
      throw rejected(
        ErrorCode.CONFIRMATION_REQUIRED,
        "This confirmation is invalid, expired, already used, or was for different settings. Call again without confirm_token to get a fresh summary for the user.",
      );
    }
  }

  private async assertBudget(
    amount: number,
    currency: string,
    workspaceId: string,
  ) {
    const max = (await this.settings.targets(workspaceId)).maxDailyBudget;
    if (amount > max) {
      throw rejected(
        ErrorCode.BUDGET_LIMIT,
        `Daily budget ${formatMoney(amount, currency)} is above this workspace's limit of ${formatMoney(max, currency)}.`,
      );
    }
  }

  private targeting(input: TargetingInput): Record<string, unknown> {
    const cities = input.cities?.map((c) => ({
      key: c.key,
      ...(c.radiusKm ? { radius: c.radiusKm, distance_unit: "kilometer" } : {}),
    }));
    const regions = input.regionKeys?.map((key) => ({ key }));
    const geo: Record<string, unknown> = {};
    if (cities?.length) geo.cities = cities;
    if (regions?.length) geo.regions = regions;
    if (!cities?.length && !regions?.length)
      geo.countries = input.countries?.length ? input.countries : ["IN"];
    const out: Record<string, unknown> = {
      geo_locations: geo,
      age_min: input.ageMin ?? 18,
      age_max: input.ageMax ?? 65,
      targeting_automation: { advantage_audience: 0 },
    };
    if (input.genders === "male") out.genders = [1];
    if (input.genders === "female") out.genders = [2];
    if (input.interests?.length) {
      out.flexible_spec = [
        {
          interests: input.interests.map((i) => ({
            id: i.id,
            ...(i.name ? { name: i.name } : {}),
          })),
        },
      ];
    }
    return out;
  }

  private adsManagerUrl(ws: Workspace, campaignId: string): string {
    const act = text(
      ws.adAccount.details.accountId,
      ws.adAccount.externalId.replace(/^act_/, ""),
    );
    const business = ws.business
      ? `&business_id=${ws.business.externalId}`
      : "";
    return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}${business}&selected_campaign_ids=${campaignId}`;
  }

  private record(
    actor: AdsActor,
    action: string,
    target: string,
    data: Record<string, unknown>,
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
}
