import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { CreativesService } from "@modules/creatives/application/creatives.service";
import { workspaceMembers } from "@modules/iam/infrastructure/iam.tables";
import {
  AdObjectType,
  AdSetSummary,
  AdStatus,
  CampaignSummary,
  InsightRow,
  META_ADS,
  MetaAds,
} from "@modules/meta/domain/ports/meta-ads";
import {
  periodsFor,
  ReportPreset,
  todayIn,
} from "@modules/reports/domain/periods";
import { SettingsService } from "@modules/settings/application/settings.service";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { ForbiddenError, ValidationError } from "@shared/errors/domain-error";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AdsActor } from "../domain/ads.types";
import { CreativeEdit } from "../domain/creative-edit";
import { resultFor } from "../domain/goals";
import { toMajor } from "../domain/money";
import { summarizeTargeting } from "../domain/targeting-summary";
import { AdsService, Workspace } from "./ads.service";

export const MAX_LISTED_CAMPAIGNS = 100;
const MANAGER_ROLES = new Set(["owner", "admin"]);

export type CampaignStatusFilter = "all" | "active" | "paused";

export interface Metrics {
  spend: number;
  results: number;
  resultType: string | null;
  costPerResult: number | null;
  impressions: number;
  linkClicks: number;
  ctr: number | null;
}

export interface BudgetView {
  level: "campaign" | "adset" | null;
  type: "daily" | "lifetime" | null;
  amount: number | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

function metrics(row: InsightRow | undefined): Metrics {
  if (!row) {
    return {
      spend: 0,
      results: 0,
      resultType: null,
      costPerResult: null,
      impressions: 0,
      linkClicks: 0,
      ctr: null,
    };
  }
  const result = resultFor(row.objective, row.actions);
  return {
    spend: round(row.spend),
    results: result?.count ?? 0,
    resultType: result?.action ?? null,
    costPerResult: result ? round(row.spend / result.count) : null,
    impressions: row.impressions,
    linkClicks: row.linkClicks,
    ctr: row.impressions
      ? round((row.linkClicks * 100) / row.impressions)
      : null,
  };
}

const visible = (status: string) =>
  status !== "DELETED" && status !== "ARCHIVED";

@Injectable()
export class CampaignManagerService {
  constructor(
    private readonly ads: AdsService,
    @Inject(META_ADS) private readonly meta: MetaAds,
    private readonly settings: SettingsService,
    private readonly creatives: CreativesService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async list(
    ctx: TenantContext,
    preset: ReportPreset,
    status: CampaignStatusFilter,
  ) {
    const ws = await this.ads.account(ctx.workspaceId);
    const period = this.period(ws, preset);
    const account = ws.adAccount.externalId;
    const [campaigns, adSets, rows, canManage] = await Promise.all([
      this.meta.campaigns(ws.token, account),
      this.meta.adSets(ws.token, account),
      this.meta.insights(ws.token, account, {
        level: "campaign",
        since: period.since,
        until: period.until,
        daily: false,
        limit: 500,
      }),
      this.canManage(ctx),
    ]);
    const insights = new Map(rows.map((r) => [r.id, r]));
    const setsByCampaign = new Map<string, AdSetSummary[]>();
    for (const s of adSets.filter((a) => visible(a.status))) {
      setsByCampaign.set(s.campaignId, [
        ...(setsByCampaign.get(s.campaignId) ?? []),
        s,
      ]);
    }
    const matching = campaigns
      .filter((c) =>
        status === "all"
          ? visible(c.status)
          : c.status === status.toUpperCase(),
      )
      .map((c) =>
        this.campaignRow(
          ws,
          c,
          setsByCampaign.get(c.id) ?? [],
          insights.get(c.id),
        ),
      )
      .sort(
        (a, b) =>
          Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") ||
          b.metrics.spend - a.metrics.spend ||
          b.createdTime.localeCompare(a.createdTime),
      );
    return {
      currency: ws.currency,
      preset,
      period,
      canManage,
      total: matching.length,
      truncated: matching.length > MAX_LISTED_CAMPAIGNS,
      campaigns: matching.slice(0, MAX_LISTED_CAMPAIGNS),
    };
  }

  async detail(ctx: TenantContext, id: string, preset: ReportPreset) {
    const ws = await this.ads.account(ctx.workspaceId);
    await this.ads.owned(ws, id, "campaign");
    const period = this.period(ws, preset);
    const query = (level: "campaign" | "adset" | "ad") =>
      this.meta.insights(ws.token, ws.adAccount.externalId, {
        level,
        since: period.since,
        until: period.until,
        daily: false,
        campaignId: id,
        limit: 500,
      });
    const [detail, campaignRows, adSetRows, adRows, canManage, targets] =
      await Promise.all([
        this.meta.campaign(ws.token, id),
        query("campaign"),
        query("adset"),
        query("ad"),
        this.canManage(ctx),
        this.settings.targets(ctx.workspaceId),
      ]);
    const byId = (rows: InsightRow[]) => new Map(rows.map((r) => [r.id, r]));
    const setRows = byId(adSetRows);
    const ads = byId(adRows);
    const sets = detail.adSets.filter((s) => visible(s.status));
    const cbo =
      detail.campaign.dailyBudget !== null ||
      detail.campaign.lifetimeBudget !== null;
    const money = (v: number | null) => toMajor(v, ws.currency);
    return {
      currency: ws.currency,
      preset,
      period,
      canManage,
      guardrails: {
        maxDailyBudget: targets.maxDailyBudget,
        monthlyBudget: targets.monthlyBudget,
      },
      campaign: this.campaignRow(
        ws,
        detail.campaign,
        sets,
        campaignRows.find((r) => r.id === id),
      ),
      adSets: sets.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        effectiveStatus: s.effectiveStatus,
        optimizationGoal: s.optimizationGoal,
        budget: {
          level: cbo ? ("campaign" as const) : ("adset" as const),
          type:
            s.dailyBudget !== null
              ? ("daily" as const)
              : s.lifetimeBudget !== null
                ? ("lifetime" as const)
                : null,
          amount: money(s.dailyBudget ?? s.lifetimeBudget),
        },
        budgetEditable: !cbo && s.dailyBudget !== null,
        targeting: summarizeTargeting(s.targeting),
        metrics: metrics(setRows.get(s.id)),
      })),
      ads: detail.ads
        .filter((a) => visible(a.status))
        .map((a) => {
          const c = a.creative;
          return {
            id: a.id,
            name: a.name,
            adSetId: a.adSetId,
            status: a.status,
            effectiveStatus: a.effectiveStatus,
            creative: {
              id: c?.id ?? null,
              kind: c?.kind ?? ("other" as const),
              editable: c?.kind === "link",
              primaryText: c?.body ?? null,
              headline: c?.title ?? null,
              description: c?.description ?? null,
              callToAction: c?.callToAction ?? null,
              link: c?.linkUrl ?? null,
              imageUrl: c?.imageUrl ?? null,
              thumbnailUrl: c?.thumbnailUrl ?? c?.imageUrl ?? null,
              leadFormId: c?.leadFormId ?? null,
            },
            metrics: metrics(ads.get(a.id)),
          };
        }),
    };
  }

  async setStatus(
    ctx: TenantContext,
    type: AdObjectType,
    id: string,
    status: AdStatus,
  ) {
    await this.assertCanManage(ctx);
    return this.ads.changeStatus(this.actor(ctx), id, status, type);
  }

  async setBudget(
    ctx: TenantContext,
    type: "campaign" | "adset",
    id: string,
    dailyBudget: number,
  ) {
    await this.assertCanManage(ctx);
    return this.ads.changeDailyBudget(this.actor(ctx), id, dailyBudget, type);
  }

  async editAd(
    ctx: TenantContext,
    id: string,
    edit: CreativeEdit & { creativeId?: string },
  ) {
    await this.assertCanManage(ctx);
    const { creativeId, ...rest } = edit;
    if (creativeId && rest.imageUrl) {
      throw new ValidationError(
        "Choose either an image from your library or an image link, not both.",
      );
    }
    let imageUrl = rest.imageUrl;
    if (creativeId) {
      const view = this.creatives.view(
        await this.creatives.get(ctx.workspaceId, creativeId),
      );
      if (view.kind !== "image")
        throw new ValidationError("Choose an image, not a video.");
      imageUrl = view.url;
    }
    return this.ads.updateAdCreative(this.actor(ctx), id, {
      ...rest,
      imageUrl,
    });
  }

  async canManage(ctx: TenantContext): Promise<boolean> {
    const member = firstOrNull(
      await this.db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, ctx.workspaceId),
            eq(workspaceMembers.userId, ctx.userId),
          ),
        )
        .limit(1),
    );
    return member !== null && MANAGER_ROLES.has(member.role);
  }

  private async assertCanManage(ctx: TenantContext) {
    if (!(await this.canManage(ctx))) {
      throw new ForbiddenError(
        "Only workspace owners and admins can change campaigns.",
      );
    }
  }

  private actor(ctx: TenantContext): AdsActor {
    return { userId: ctx.userId, workspaceId: ctx.workspaceId, via: "app" };
  }

  private period(ws: Workspace, preset: ReportPreset) {
    const timezone =
      typeof ws.adAccount.details.timezone === "string"
        ? ws.adAccount.details.timezone
        : "Asia/Kolkata";
    return periodsFor(preset, todayIn(timezone)).current;
  }

  private campaignRow(
    ws: Workspace,
    c: CampaignSummary,
    adSets: AdSetSummary[],
    row: InsightRow | undefined,
  ) {
    const money = (v: number | null) => toMajor(v, ws.currency);
    const cbo = c.dailyBudget !== null || c.lifetimeBudget !== null;
    const daily = adSets.reduce((sum, s) => sum + (s.dailyBudget ?? 0), 0);
    const lifetime = adSets.reduce(
      (sum, s) => sum + (s.lifetimeBudget ?? 0),
      0,
    );
    const budget: BudgetView = cbo
      ? {
          level: "campaign",
          type: c.dailyBudget !== null ? "daily" : "lifetime",
          amount: money(c.dailyBudget ?? c.lifetimeBudget),
        }
      : daily
        ? { level: "adset", type: "daily", amount: money(daily) }
        : lifetime
          ? { level: "adset", type: "lifetime", amount: money(lifetime) }
          : { level: adSets.length ? "adset" : null, type: null, amount: null };
    return {
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status,
      effectiveStatus: c.effectiveStatus,
      budget,
      budgetEditable: cbo && c.dailyBudget !== null,
      adSetCount: adSets.length,
      startTime: c.startTime,
      stopTime: c.stopTime,
      createdTime: c.createdTime,
      adsManagerUrl: this.ads.adsManagerUrl(ws, c.id),
      metrics: metrics(row),
    };
  }
}
