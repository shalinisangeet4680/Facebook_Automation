import { Injectable } from "@nestjs/common";

import {
  AdObject,
  AdObjectType,
  AdSetSummary,
  AdStatus,
  AdSummary,
  CampaignDetail,
  CampaignDraftInput,
  CampaignDraftResult,
  CampaignSummary,
  InsightQuery,
  InsightRow,
  MetaAds,
  PixelEventCount,
  TargetingOption,
  TargetingSearchType,
} from "../domain/ports/meta-ads";
import { GraphApiClient, GraphParams } from "./graph-api.client";

const CAMPAIGN_FIELDS =
  "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time";
const ADSET_FIELDS =
  "id,name,campaign_id,status,effective_status,optimization_goal,billing_event,daily_budget,lifetime_budget,targeting,promoted_object";
const AD_FIELDS =
  "id,name,adset_id,status,effective_status,creative{id,title,body,object_story_spec,image_url,thumbnail_url,call_to_action_type}";
const INSIGHT_FIELDS =
  "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,account_id,account_name,objective,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,actions,date_start,date_stop";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const optNum = (v: unknown): number | null =>
  v === undefined || v === null || v === "" ? null : num(v);
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : fallback;
const optStr = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

interface RawCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
}

interface RawAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  effective_status: string;
  optimization_goal: string;
  billing_event: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  promoted_object?: Record<string, unknown>;
}

interface RawAd {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  effective_status: string;
  creative?: {
    id: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
    call_to_action_type?: string;
    object_story_spec?: {
      link_data?: {
        link?: string;
        message?: string;
        name?: string;
        picture?: string;
        call_to_action?: { type?: string };
      };
    };
  };
}

export function toCampaign(r: RawCampaign): CampaignSummary {
  return {
    id: r.id,
    name: r.name,
    objective: r.objective,
    status: r.status,
    effectiveStatus: r.effective_status,
    dailyBudget: optNum(r.daily_budget),
    lifetimeBudget: optNum(r.lifetime_budget),
    startTime: r.start_time ?? null,
    stopTime: r.stop_time ?? null,
    createdTime: r.created_time,
  };
}

function toAdSet(r: RawAdSet): AdSetSummary {
  return {
    id: r.id,
    name: r.name,
    campaignId: r.campaign_id,
    status: r.status,
    effectiveStatus: r.effective_status,
    optimizationGoal: r.optimization_goal,
    billingEvent: r.billing_event,
    dailyBudget: optNum(r.daily_budget),
    lifetimeBudget: optNum(r.lifetime_budget),
    targeting: r.targeting ?? {},
    promotedObject: r.promoted_object ?? null,
  };
}

function toAd(r: RawAd): AdSummary {
  const c = r.creative;
  const link = c?.object_story_spec?.link_data;
  return {
    id: r.id,
    name: r.name,
    adSetId: r.adset_id,
    status: r.status,
    effectiveStatus: r.effective_status,
    creative: c
      ? {
          id: c.id,
          title: link?.name ?? c.title ?? null,
          body: link?.message ?? c.body ?? null,
          linkUrl: link?.link ?? null,
          imageUrl: link?.picture ?? c.image_url ?? c.thumbnail_url ?? null,
          callToAction:
            link?.call_to_action?.type ?? c.call_to_action_type ?? null,
        }
      : null,
  };
}

@Injectable()
export class GraphAdsClient extends GraphApiClient implements MetaAds {
  async insights(
    token: string,
    adAccountId: string,
    query: InsightQuery,
  ): Promise<InsightRow[]> {
    const params: GraphParams = {
      level: query.level,
      fields: INSIGHT_FIELDS,
      limit: query.limit,
    };
    if (query.since && query.until) {
      params.time_range = { since: query.since, until: query.until };
    } else {
      params.date_preset = query.datePreset ?? "last_7d";
    }
    if (query.daily) params.time_increment = 1;
    if (query.campaignId) {
      params.filtering = [
        { field: "campaign.id", operator: "EQUAL", value: query.campaignId },
      ];
    }
    const res = await this.get<{ data?: Record<string, unknown>[] }>(
      token,
      `/${adAccountId}/insights`,
      params,
    );
    return (res.data ?? []).slice(0, query.limit).map((r) => {
      const id =
        query.level === "account"
          ? `act_${String(r.account_id)}`
          : str(r[`${query.level}_id`]);
      const name =
        query.level === "account"
          ? str(r.account_name)
          : str(r[`${query.level}_name`]);
      const actions: Record<string, number> = {};
      for (const a of (r.actions as
        { action_type: string; value: string }[] | undefined) ?? []) {
        actions[a.action_type] = num(a.value);
      }
      return {
        id,
        name,
        objective: optStr(r.objective),
        dateStart: String(r.date_start),
        dateStop: String(r.date_stop),
        spend: num(r.spend),
        impressions: num(r.impressions),
        reach: num(r.reach),
        frequency: num(r.frequency),
        linkClicks: num(r.inline_link_clicks),
        ctr: num(r.inline_link_click_ctr),
        cpc: optNum(r.cost_per_inline_link_click),
        cpm: num(r.cpm),
        actions,
      };
    });
  }

  async campaigns(
    token: string,
    adAccountId: string,
  ): Promise<CampaignSummary[]> {
    const rows = await this.list<RawCampaign>(
      token,
      `/${adAccountId}/campaigns`,
      {
        fields: CAMPAIGN_FIELDS,
      },
    );
    return rows.map(toCampaign);
  }

  async campaign(token: string, campaignId: string): Promise<CampaignDetail> {
    const [campaign, adSets, ads] = await Promise.all([
      this.get<RawCampaign>(token, `/${campaignId}`, {
        fields: CAMPAIGN_FIELDS,
      }),
      this.list<RawAdSet>(token, `/${campaignId}/adsets`, {
        fields: ADSET_FIELDS,
      }),
      this.list<RawAd>(token, `/${campaignId}/ads`, { fields: AD_FIELDS }),
    ]);
    return {
      campaign: toCampaign(campaign),
      adSets: adSets.map(toAdSet),
      ads: ads.map(toAd),
    };
  }

  async object(token: string, id: string): Promise<AdObject> {
    const meta = await this.get<{ metadata?: { type?: string } }>(
      token,
      `/${id}`,
      {
        metadata: 1,
        fields: "id",
      },
    );
    const type = meta.metadata?.type as AdObjectType | undefined;
    if (type !== "campaign" && type !== "adset" && type !== "ad") {
      throw new Error(`Unsupported object type ${String(type)}`);
    }
    const fields =
      type === "ad"
        ? "id,name,status,effective_status,account_id,campaign_id"
        : type === "adset"
          ? "id,name,status,effective_status,account_id,campaign_id,daily_budget"
          : "id,name,status,effective_status,account_id,daily_budget";
    const r = await this.get<Record<string, unknown>>(token, `/${id}`, {
      fields,
    });
    return {
      id: String(r.id),
      type,
      name: str(r.name),
      status: str(r.status),
      effectiveStatus: str(r.effective_status),
      accountId: `act_${str(r.account_id)}`,
      campaignId: type === "campaign" ? String(r.id) : optStr(r.campaign_id),
      dailyBudget: optNum(r.daily_budget),
    };
  }

  async pixelEvents(
    token: string,
    pixelId: string,
    sinceUnix: number,
  ): Promise<PixelEventCount[]> {
    const res = await this.get<{
      data?: { data?: { value: string; count: number }[] }[];
    }>(token, `/${pixelId}/stats`, {
      aggregation: "event",
      start_time: sinceUnix,
    });
    const totals = new Map<string, number>();
    for (const bucket of res.data ?? []) {
      for (const row of bucket.data ?? []) {
        totals.set(row.value, (totals.get(row.value) ?? 0) + num(row.count));
      }
    }
    return [...totals.entries()]
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
  }

  async searchTargeting(
    token: string,
    _adAccountId: string,
    type: TargetingSearchType,
    query: string,
    countryCode: string | null,
  ): Promise<TargetingOption[]> {
    const params: GraphParams =
      type === "interest"
        ? { type: "adinterest", q: query, limit: 15 }
        : {
            type: "adgeolocation",
            q: query,
            location_types: [type],
            limit: 15,
            ...(countryCode ? { country_code: countryCode } : {}),
          };
    const res = await this.get<{ data?: Record<string, unknown>[] }>(
      token,
      "/search",
      params,
    );
    return (res.data ?? [])
      .filter((r) => type === "interest" || r.type === type)
      .map((r) => ({
        key: String(r.key ?? r.id),
        name: str(r.name),
        type: str(r.type, type),
        region: optStr(r.region),
        countryCode: optStr(r.country_code),
        audienceSize: optNum(r.audience_size_upper_bound ?? r.audience_size),
      }));
  }

  async createDraft(
    token: string,
    input: CampaignDraftInput,
  ): Promise<CampaignDraftResult> {
    const account = input.adAccountId;
    const campaign = await this.post<{ id: string }>(
      token,
      `/${account}/campaigns`,
      {
        name: input.name,
        objective: input.objective,
        status: "PAUSED",
        buying_type: "AUCTION",
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
      },
    );
    try {
      const adSet = await this.post<{ id: string }>(
        token,
        `/${account}/adsets`,
        {
          name: `${input.name} – Ad set`,
          campaign_id: campaign.id,
          daily_budget: input.dailyBudget,
          billing_event: input.adSet.billingEvent,
          optimization_goal: input.adSet.optimizationGoal,
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: input.adSet.targeting,
          status: "PAUSED",
          ...(input.adSet.destinationType
            ? { destination_type: input.adSet.destinationType }
            : {}),
          ...(input.adSet.promotedObject
            ? { promoted_object: input.adSet.promotedObject }
            : {}),
        },
      );
      const c = input.creative;
      const creative = await this.post<{ id: string }>(
        token,
        `/${account}/adcreatives`,
        { name: `${input.name} – Creative`, ...this.creativeSpec(c) },
      );
      const ad = await this.post<{ id: string }>(token, `/${account}/ads`, {
        name: `${input.name} – Ad`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: "PAUSED",
      });
      return {
        campaignId: campaign.id,
        adSetId: adSet.id,
        creativeId: creative.id,
        adId: ad.id,
      };
    } catch (err) {
      await this.post(token, `/${campaign.id}`, {}, "DELETE").catch(
        () => undefined,
      );
      throw err;
    }
  }

  private creativeSpec(c: CampaignDraftInput["creative"]): GraphParams {
    if (c.existingPost?.platform === "facebook") {
      return { object_story_id: c.existingPost.id };
    }
    if (c.existingPost?.platform === "instagram") {
      return {
        object_id: c.pageId,
        ...(c.instagramId ? { instagram_user_id: c.instagramId } : {}),
        source_instagram_media_id: c.existingPost.id,
        call_to_action: { type: c.callToAction, value: { link: c.link } },
      };
    }
    return {
      object_story_spec: {
        page_id: c.pageId,
        ...(c.instagramId ? { instagram_user_id: c.instagramId } : {}),
        link_data: {
          link: c.link,
          message: c.message,
          name: c.headline,
          ...(c.description ? { description: c.description } : {}),
          ...(c.imageHash ? { image_hash: c.imageHash } : {}),
          ...(c.imageUrl && !c.imageHash ? { picture: c.imageUrl } : {}),
          call_to_action: { type: c.callToAction, value: { link: c.link } },
        },
      },
    };
  }

  async setStatus(token: string, id: string, status: AdStatus): Promise<void> {
    await this.post(token, `/${id}`, { status });
  }

  async setDailyBudget(
    token: string,
    id: string,
    dailyBudget: number,
  ): Promise<void> {
    await this.post(token, `/${id}`, { daily_budget: dailyBudget });
  }
}
