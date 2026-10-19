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
  CreativeInput,
  CreativeReplaceInput,
  CustomAudienceSummary,
  InsightQuery,
  InsightRow,
  LeadFormInput,
  LeadFormSummary,
  LeadRecord,
  MetaAds,
  PixelDetails,
  PixelEventCount,
  TargetingOption,
  TargetingSearchType,
  UploadedVideo,
} from "../domain/ports/meta-ads";
import { metaRejected } from "../domain/meta.errors";
import { GraphApiClient, GraphParams } from "./graph-api.client";

const CAMPAIGN_FIELDS =
  "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time";
const ADSET_FIELDS =
  "id,name,campaign_id,status,effective_status,optimization_goal,billing_event,daily_budget,lifetime_budget,targeting,promoted_object";
const AD_FIELDS =
  "id,name,adset_id,status,effective_status,creative{id,title,body,object_story_id,object_story_spec,source_instagram_media_id,image_url,image_hash,thumbnail_url,video_id,call_to_action_type}";
const LEAD_FIELDS =
  "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id";
const LEAD_FORM_FIELDS = "id,name,status,locale,created_time,questions";
const VIDEO_POLL_MS = 3_000;
const VIDEO_POLL_ATTEMPTS = 40;
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

export interface RawAd {
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
    image_hash?: string;
    thumbnail_url?: string;
    video_id?: string;
    call_to_action_type?: string;
    object_story_id?: string;
    source_instagram_media_id?: string;
    object_story_spec?: {
      page_id?: string;
      instagram_user_id?: string;
      instagram_actor_id?: string;
      link_data?: {
        link?: string;
        message?: string;
        name?: string;
        description?: string;
        picture?: string;
        image_hash?: string;
        call_to_action?: {
          type?: string;
          value?: { link?: string; lead_gen_form_id?: string };
        };
      };
      video_data?: {
        video_id?: string;
        message?: string;
        title?: string;
        link_description?: string;
        image_url?: string;
        image_hash?: string;
        call_to_action?: {
          type?: string;
          value?: { link?: string; lead_gen_form_id?: string };
        };
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

export function toAd(r: RawAd): AdSummary {
  const c = r.creative;
  const spec = c?.object_story_spec;
  const link = spec?.link_data;
  const video = spec?.video_data;
  const postId = c?.object_story_id ?? c?.source_instagram_media_id ?? null;
  const cta = link?.call_to_action ?? video?.call_to_action;
  const kind = postId ? "post" : video ? "video" : link ? "link" : "other";
  return {
    id: r.id,
    name: r.name,
    adSetId: r.adset_id,
    status: r.status,
    effectiveStatus: r.effective_status,
    creative: c
      ? {
          id: c.id,
          kind,
          title: link?.name ?? video?.title ?? c.title ?? null,
          body: link?.message ?? video?.message ?? c.body ?? null,
          description: link?.description ?? video?.link_description ?? null,
          linkUrl: link?.link ?? cta?.value?.link ?? null,
          imageUrl:
            link?.picture ??
            video?.image_url ??
            c.image_url ??
            c.thumbnail_url ??
            null,
          imageHash:
            link?.image_hash ?? video?.image_hash ?? c.image_hash ?? null,
          thumbnailUrl:
            c.thumbnail_url ??
            video?.image_url ??
            c.image_url ??
            link?.picture ??
            null,
          callToAction: cta?.type ?? c.call_to_action_type ?? null,
          pageId: spec?.page_id ?? null,
          instagramId:
            spec?.instagram_user_id ?? spec?.instagram_actor_id ?? null,
          postId,
          leadFormId: cta?.value?.lead_gen_form_id ?? null,
          videoId: video?.video_id ?? c.video_id ?? null,
        }
      : null,
  };
}

export function leadFormParams(input: LeadFormInput): GraphParams {
  const button = input.thankYou.button;
  return {
    name: input.name,
    locale: input.locale,
    questions: [
      ...input.questions.map((type) => ({ type })),
      ...input.customQuestions.map((q) => ({
        type: "CUSTOM",
        key: q.key,
        label: q.label,
        ...(q.options.length
          ? {
              options: q.options.map((value, i) => ({
                key: `${q.key}_${i + 1}`,
                value,
              })),
            }
          : {}),
      })),
    ],
    privacy_policy: {
      url: input.privacyPolicyUrl,
      link_text: "Privacy policy",
    },
    context_card: {
      title: input.intro.headline,
      style: "PARAGRAPH_STYLE",
      ...(input.intro.description
        ? { content: [input.intro.description] }
        : {}),
    },
    thank_you_page: {
      title: input.thankYou.title,
      body: input.thankYou.body,
      button_text: button.text,
      ...(button.type === "website"
        ? { button_type: "VIEW_WEBSITE", website_url: button.url }
        : {
            button_type: "CALL_BUSINESS",
            business_phone_number: button.phone,
          }),
    },
    ...(button.type === "website" ? { follow_up_action_url: button.url } : {}),
  };
}

interface RawLead {
  id: string;
  created_time: string;
  field_data?: { name: string; values?: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
}

export function toLead(r: RawLead, formId: string): LeadRecord {
  return {
    id: r.id,
    formId: r.form_id ?? formId,
    createdTime: new Date(r.created_time).toISOString(),
    fieldData: (r.field_data ?? []).map((f) => ({
      name: f.name,
      values: (f.values ?? []).map(String),
    })),
    adId: r.ad_id ?? null,
    adName: r.ad_name ?? null,
    adSetId: r.adset_id ?? null,
    adSetName: r.adset_name ?? null,
    campaignId: r.campaign_id ?? null,
    campaignName: r.campaign_name ?? null,
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

  async adSets(token: string, adAccountId: string): Promise<AdSetSummary[]> {
    const rows = await this.list<RawAdSet>(token, `/${adAccountId}/adsets`, {
      fields: ADSET_FIELDS,
    });
    return rows.map(toAdSet);
  }

  async ad(token: string, adId: string): Promise<AdSummary> {
    return toAd(
      await this.get<RawAd>(token, `/${adId}`, { fields: AD_FIELDS }),
    );
  }

  async object(token: string, id: string): Promise<AdObject> {
    const attempts: { type: AdObjectType; fields: string }[] = [
      {
        type: "ad",
        fields:
          "id,name,status,effective_status,account_id,campaign_id,adset_id",
      },
      {
        type: "adset",
        fields:
          "id,name,status,effective_status,account_id,campaign_id,daily_budget,lifetime_budget",
      },
      {
        type: "campaign",
        fields:
          "id,name,status,effective_status,account_id,daily_budget,lifetime_budget,objective",
      },
    ];
    let last: unknown = null;
    for (const attempt of attempts) {
      try {
        const r = await this.get<Record<string, unknown>>(token, `/${id}`, {
          fields: attempt.fields,
        });
        return {
          id: str(r.id),
          type: attempt.type,
          name: str(r.name),
          status: str(r.status),
          effectiveStatus: str(r.effective_status),
          accountId: `act_${str(r.account_id)}`,
          campaignId:
            attempt.type === "campaign" ? str(r.id) : optStr(r.campaign_id),
          dailyBudget: optNum(r.daily_budget),
          lifetimeBudget: optNum(r.lifetime_budget),
        };
      } catch (err) {
        if ((err as { code?: string }).code !== "META_REJECTED") throw err;
        last = err;
      }
    }
    throw last;
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

  async pixel(token: string, pixelId: string): Promise<PixelDetails> {
    const res = await this.get<{
      id?: string;
      name?: string;
      last_fired_time?: string;
    }>(token, `/${pixelId}`, { fields: "id,name,last_fired_time" });
    return {
      id: str(res.id, pixelId),
      name: str(res.name),
      lastFiredTime: optStr(res.last_fired_time),
    };
  }

  async searchTargeting(
    token: string,
    _adAccountId: string,
    type: TargetingSearchType,
    query: string,
    countryCode: string | null,
  ): Promise<TargetingOption[]> {
    if (type === "industry" || type === "behavior") {
      const res = await this.get<{ data?: Record<string, unknown>[] }>(
        token,
        "/search",
        {
          type: "adTargetingCategory",
          class: type === "industry" ? "industries" : "behaviors",
          limit: 500,
        },
      );
      const q = query.toLowerCase();
      return (res.data ?? [])
        .filter((r) => str(r.name).toLowerCase().includes(q))
        .slice(0, 15)
        .map((r) => ({
          key: str(r.id),
          name: str(r.name),
          type,
          region: null,
          countryCode: null,
          audienceSize: optNum(r.audience_size_upper_bound ?? r.audience_size),
        }));
    }
    const params: GraphParams =
      type === "interest"
        ? { type: "adinterest", q: query, limit: 15 }
        : type === "work_position"
          ? { type: "adworkposition", q: query, limit: 15 }
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
      .filter(
        (r) =>
          type === "interest" || type === "work_position" || r.type === type,
      )
      .map((r) => ({
        key: str(r.key ?? r.id),
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
    const form = input.leadForm
      ? await this.createLeadForm(token, input.leadForm)
      : null;
    let campaignId: string | null = null;
    try {
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
      campaignId = campaign.id;
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
      const entries = [
        { label: "", creative: input.creative },
        ...(input.variants ?? []),
      ];
      const many = entries.length > 1;
      const ads: CampaignDraftResult["ads"] = [];
      for (const [i, entry] of entries.entries()) {
        const label = many ? entry.label || String.fromCharCode(65 + i) : "";
        const suffix = many ? `Version ${label}` : "";
        const c = form
          ? { ...entry.creative, leadFormId: form.id }
          : entry.creative;
        const creative = await this.post<{ id: string }>(
          token,
          `/${account}/adcreatives`,
          {
            name: `${input.name} – ${suffix || "Creative"}`,
            ...this.creativeSpec(c),
          },
        );
        const ad = await this.post<{ id: string }>(token, `/${account}/ads`, {
          name: `${input.name} – ${suffix || "Ad"}`,
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status: "PAUSED",
        });
        ads.push({ label, adId: ad.id, creativeId: creative.id });
      }
      return {
        campaignId: campaign.id,
        adSetId: adSet.id,
        creativeId: ads[0]!.creativeId,
        adId: ads[0]!.adId,
        ads,
        ...(form ? { leadFormId: form.id } : {}),
      };
    } catch (err) {
      if (campaignId)
        await this.post(token, `/${campaignId}`, {}, "DELETE").catch(
          () => undefined,
        );
      if (form)
        await this.post(form.pageToken, `/${form.id}`, {
          status: "ARCHIVED",
        }).catch(() => undefined);
      throw err;
    }
  }

  async uploadVideo(
    token: string,
    adAccountId: string,
    fileUrl: string,
    name: string,
  ): Promise<UploadedVideo> {
    const created = await this.post<{ id: string }>(
      token,
      `/${adAccountId}/advideos`,
      { file_url: fileUrl, name: name.slice(0, 100) },
    );
    let ready = false;
    for (let attempt = 0; attempt < VIDEO_POLL_ATTEMPTS; attempt++) {
      const res = await this.get<{ status?: { video_status?: string } }>(
        token,
        `/${created.id}`,
        { fields: "status" },
      );
      const status = res.status?.video_status;
      if (status === "ready") {
        ready = true;
        break;
      }
      if (status === "error")
        throw metaRejected(
          "Meta couldn't process this video. Use a standard MP4 (H.264) of at least 3 seconds and try again.",
        );
      await this.wait(VIDEO_POLL_MS);
    }
    if (!ready)
      throw metaRejected(
        "Meta is still processing this video. Try again in a few minutes.",
      );
    const media = await this.get<{
      picture?: string;
      thumbnails?: { data?: { uri?: string; is_preferred?: boolean }[] };
    }>(token, `/${created.id}`, { fields: "picture,thumbnails" });
    const thumbs = media.thumbnails?.data ?? [];
    return {
      videoId: created.id,
      thumbnailUrl:
        thumbs.find((t) => t.is_preferred && t.uri)?.uri ??
        thumbs.find((t) => t.uri)?.uri ??
        media.picture ??
        null,
    };
  }

  async customAudiences(
    token: string,
    adAccountId: string,
  ): Promise<CustomAudienceSummary[]> {
    const rows = await this.list<{
      id: string;
      name?: string;
      subtype?: string;
      approximate_count_lower_bound?: number | string;
    }>(token, `/${adAccountId}/customaudiences`, {
      fields: "id,name,approximate_count_lower_bound,subtype",
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Custom audience",
      subtype: r.subtype ?? null,
      approximateCount: optNum(r.approximate_count_lower_bound),
    }));
  }

  async pageAccessToken(token: string, pageId: string): Promise<string> {
    const res = await this.get<{ access_token?: string }>(token, `/${pageId}`, {
      fields: "access_token",
    });
    if (!res.access_token)
      throw metaRejected(
        "TreeVook couldn't get access to your Facebook Page. Give the system user full control of the Page, then try again.",
      );
    return res.access_token;
  }

  async leadForms(
    pageToken: string,
    pageId: string,
  ): Promise<LeadFormSummary[]> {
    const rows = await this.list<{
      id: string;
      name?: string;
      status?: string;
      locale?: string;
      created_time?: string;
      questions?: { key?: string; label?: string; type?: string }[];
    }>(pageToken, `/${pageId}/leadgen_forms`, { fields: LEAD_FORM_FIELDS });
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Instant form",
      status: r.status ?? "ACTIVE",
      locale: r.locale ?? null,
      createdTime: r.created_time ?? null,
      questions: (r.questions ?? []).map((q) => ({
        key: q.key ?? "",
        label: q.label ?? q.key ?? "",
        type: q.type ?? "CUSTOM",
      })),
    }));
  }

  async leads(
    pageToken: string,
    formId: string,
    sinceUnix: number | null,
  ): Promise<LeadRecord[]> {
    const params: Record<string, string> = { fields: LEAD_FIELDS };
    if (sinceUnix !== null)
      params.filtering = JSON.stringify([
        {
          field: "time_created",
          operator: "GREATER_THAN",
          value: sinceUnix,
        },
      ]);
    const rows = await this.list<RawLead>(
      pageToken,
      `/${formId}/leads`,
      params,
    );
    return rows.map((r) => toLead(r, formId));
  }

  private async createLeadForm(
    token: string,
    form: LeadFormInput,
  ): Promise<{ id: string; pageToken: string }> {
    const pageToken = await this.pageAccessToken(token, form.pageId);
    const created = await this.post<{ id: string }>(
      pageToken,
      `/${form.pageId}/leadgen_forms`,
      leadFormParams(form),
    );
    return { id: created.id, pageToken };
  }

  async replaceCreative(
    token: string,
    input: CreativeReplaceInput,
  ): Promise<{ creativeId: string }> {
    const creative = await this.post<{ id: string }>(
      token,
      `/${input.adAccountId}/adcreatives`,
      { name: input.name, ...this.creativeSpec(input.creative) },
    );
    await this.post(token, `/${input.adId}`, {
      creative: { creative_id: creative.id },
    });
    return { creativeId: creative.id };
  }

  private creativeSpec(c: CreativeInput): GraphParams {
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
    const cta = {
      type: c.callToAction,
      value: c.leadFormId
        ? { lead_gen_form_id: c.leadFormId }
        : { link: c.link },
    };
    if (c.videoId) {
      return {
        object_story_spec: {
          page_id: c.pageId,
          ...(c.instagramId ? { instagram_user_id: c.instagramId } : {}),
          video_data: {
            video_id: c.videoId,
            message: c.message,
            title: c.headline,
            ...(c.description ? { link_description: c.description } : {}),
            ...(c.imageHash ? { image_hash: c.imageHash } : {}),
            ...(c.imageUrl && !c.imageHash ? { image_url: c.imageUrl } : {}),
            call_to_action: cta,
          },
        },
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
          call_to_action: cta,
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
