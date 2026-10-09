import { Injectable } from "@nestjs/common";

import { metaRejected } from "../domain/meta.errors";
import {
  AdObject,
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

const ACCOUNT = "act_1201000000000001";
const DAY_MS = 86_400_000;

interface Store {
  campaigns: Map<string, CampaignSummary>;
  adSets: Map<string, AdSetSummary>;
  ads: Map<string, AdSummary>;
  sequence: number;
}

function seed(): Store {
  const created = new Date(Date.now() - 40 * DAY_MS).toISOString();
  const campaigns = new Map<string, CampaignSummary>([
    [
      "120210000000000001",
      {
        id: "120210000000000001",
        name: "Clinic owners – Free demo – Bihar",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        dailyBudget: null,
        lifetimeBudget: null,
        startTime: created,
        stopTime: null,
        createdTime: created,
      },
    ],
    [
      "120210000000000002",
      {
        id: "120210000000000002",
        name: "Website visits – Feature tour",
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        effectiveStatus: "PAUSED",
        dailyBudget: null,
        lifetimeBudget: null,
        startTime: created,
        stopTime: null,
        createdTime: created,
      },
    ],
  ]);
  const adSets = new Map<string, AdSetSummary>([
    [
      "120220000000000001",
      {
        id: "120220000000000001",
        name: "Doctors 28–55 – Patna, Gaya, Muzaffarpur",
        campaignId: "120210000000000001",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        optimizationGoal: "OFFSITE_CONVERSIONS",
        billingEvent: "IMPRESSIONS",
        dailyBudget: 80_000,
        lifetimeBudget: null,
        targeting: {
          age_min: 28,
          age_max: 55,
          geo_locations: { cities: [{ key: "1035921", name: "Patna" }] },
        },
        promotedObject: {
          pixel_id: "2519233968487265",
          custom_event_type: "LEAD",
        },
      },
    ],
    [
      "120220000000000002",
      {
        id: "120220000000000002",
        name: "India – Broad",
        campaignId: "120210000000000002",
        status: "ACTIVE",
        effectiveStatus: "CAMPAIGN_PAUSED",
        optimizationGoal: "LANDING_PAGE_VIEWS",
        billingEvent: "IMPRESSIONS",
        dailyBudget: 50_000,
        lifetimeBudget: null,
        targeting: {
          age_min: 25,
          age_max: 60,
          geo_locations: { countries: ["IN"] },
        },
        promotedObject: null,
      },
    ],
  ]);
  const ad = (
    id: string,
    adSetId: string,
    name: string,
    title: string,
    body: string,
    status = "ACTIVE",
  ): [string, AdSummary] => [
    id,
    {
      id,
      name,
      adSetId,
      status,
      effectiveStatus: status,
      creative: {
        id: `${id}9`,
        title,
        body,
        linkUrl: "https://arogyasystem.com/",
        imageUrl: "https://arogyasystem.com/og.png",
        callToAction: "LEARN_MORE",
      },
    },
  ];
  const ads = new Map<string, AdSummary>([
    ad(
      "120230000000000001",
      "120220000000000001",
      "Queue chaos – carousel",
      "Run your clinic from one screen",
      "Appointments, prescriptions and billing in one simple app. Try the free demo clinic.",
    ),
    ad(
      "120230000000000002",
      "120220000000000001",
      "Doctor testimonial – video",
      "Doctors in Patna save 2 hours a day",
      "No more paper registers. See how Arogya System works in 2 minutes.",
    ),
    ad(
      "120230000000000003",
      "120220000000000002",
      "Feature tour – image",
      "See every feature in 60 seconds",
      "Patient records, WhatsApp reminders and GST bills. Free for 14 days.",
      "PAUSED",
    ),
  ]);
  return { campaigns, adSets, ads, sequence: 100 };
}

let store = seed();

export function resetMockAds(): void {
  store = seed();
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function range(query: InsightQuery): { from: Date; to: Date } {
  const today = new Date(`${iso(new Date())}T00:00:00Z`);
  const back = (days: number) => new Date(today.getTime() - days * DAY_MS);
  if (query.since && query.until) {
    return {
      from: new Date(`${query.since}T00:00:00Z`),
      to: new Date(`${query.until}T00:00:00Z`),
    };
  }
  switch (query.datePreset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: back(1), to: back(1) };
    case "last_14d":
      return { from: back(14), to: back(1) };
    case "last_30d":
      return { from: back(30), to: back(1) };
    case "this_month":
      return {
        from: new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
        ),
        to: today,
      };
    case "last_month": {
      const first = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      const last = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0),
      );
      return { from: first, to: last };
    }
    case "maximum":
      return { from: back(40), to: today };
    default:
      return { from: back(7), to: back(1) };
  }
}

interface Totals {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  actions: Record<string, number>;
}

function adDay(
  ad: AdSummary,
  adSet: AdSetSummary,
  campaign: CampaignSummary,
  day: string,
): Totals {
  const live =
    campaign.status === "ACTIVE" &&
    adSet.status === "ACTIVE" &&
    ad.status === "ACTIVE";
  const created = campaign.createdTime.slice(0, 10);
  if (!live || day < created) {
    return { spend: 0, impressions: 0, reach: 0, linkClicks: 0, actions: {} };
  }
  const siblings = [...store.ads.values()].filter(
    (a) => a.adSetId === adSet.id && a.status === "ACTIVE",
  );
  const share = 1 / Math.max(siblings.length, 1);
  const r = hash(`${ad.id}:${day}`);
  const spend =
    Math.round(
      ((adSet.dailyBudget ?? 0) / 100) * share * (0.88 + r * 0.12) * 100,
    ) / 100;
  const impressions = Math.round(spend * (38 + r * 10));
  const linkClicks = Math.round(impressions * (0.009 + r * 0.008));
  const actions: Record<string, number> = {
    link_click: linkClicks,
    landing_page_view: Math.round(linkClicks * 0.72),
  };
  if (campaign.objective === "OUTCOME_LEADS") {
    actions.lead = Math.round(spend / (150 + r * 90));
    actions["offsite_conversion.fb_pixel_lead"] = actions.lead;
  }
  return {
    spend,
    impressions,
    reach: Math.round(impressions * 0.74),
    linkClicks,
    actions,
  };
}

function add(into: Totals, part: Totals): void {
  into.spend += part.spend;
  into.impressions += part.impressions;
  into.reach += part.reach;
  into.linkClicks += part.linkClicks;
  for (const [k, v] of Object.entries(part.actions))
    into.actions[k] = (into.actions[k] ?? 0) + v;
}

@Injectable()
export class MockMetaAds implements MetaAds {
  insights(
    _token: string,
    adAccountId: string,
    query: InsightQuery,
  ): Promise<InsightRow[]> {
    const { from, to } = range(query);
    const days: string[] = [];
    for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS)
      days.push(iso(new Date(t)));
    const buckets = new Map<
      string,
      {
        id: string;
        name: string;
        objective: string | null;
        start: string;
        stop: string;
        totals: Totals;
      }
    >();

    for (const ad of store.ads.values()) {
      const adSet = store.adSets.get(ad.adSetId);
      const campaign = adSet
        ? store.campaigns.get(adSet.campaignId)
        : undefined;
      if (!adSet || !campaign) continue;
      if (query.campaignId && campaign.id !== query.campaignId) continue;
      const entity =
        query.level === "account"
          ? { id: adAccountId, name: "Arogya System Ads", objective: null }
          : query.level === "campaign"
            ? {
                id: campaign.id,
                name: campaign.name,
                objective: campaign.objective,
              }
            : query.level === "adset"
              ? {
                  id: adSet.id,
                  name: adSet.name,
                  objective: campaign.objective,
                }
              : { id: ad.id, name: ad.name, objective: campaign.objective };
      for (const day of days) {
        const key = query.daily ? `${entity.id}:${day}` : entity.id;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = {
            ...entity,
            start: query.daily ? day : days[0]!,
            stop: query.daily ? day : days[days.length - 1]!,
            totals: {
              spend: 0,
              impressions: 0,
              reach: 0,
              linkClicks: 0,
              actions: {},
            },
          };
          buckets.set(key, bucket);
        }
        add(bucket.totals, adDay(ad, adSet, campaign, day));
      }
    }

    const rows = [...buckets.values()]
      .filter((b) => b.totals.impressions > 0)
      .map<InsightRow>((b) => {
        const t = b.totals;
        const spend = Math.round(t.spend * 100) / 100;
        return {
          id: b.id,
          name: b.name,
          objective: b.objective,
          dateStart: b.start,
          dateStop: b.stop,
          spend,
          impressions: t.impressions,
          reach: t.reach,
          frequency: t.reach
            ? Math.round((t.impressions / t.reach) * 100) / 100
            : 0,
          linkClicks: t.linkClicks,
          ctr: t.impressions
            ? Math.round((t.linkClicks / t.impressions) * 10000) / 100
            : 0,
          cpc: t.linkClicks
            ? Math.round((spend / t.linkClicks) * 100) / 100
            : null,
          cpm: t.impressions
            ? Math.round((spend / t.impressions) * 100000) / 100
            : 0,
          actions: t.actions,
        };
      });
    return Promise.resolve(rows.slice(0, query.limit));
  }

  campaigns(_token: string, adAccountId: string): Promise<CampaignSummary[]> {
    if (adAccountId !== ACCOUNT) return Promise.resolve([]);
    return Promise.resolve(
      [...store.campaigns.values()].sort((a, b) =>
        b.createdTime.localeCompare(a.createdTime),
      ),
    );
  }

  campaign(_token: string, campaignId: string): Promise<CampaignDetail> {
    const campaign = store.campaigns.get(campaignId);
    if (!campaign) return Promise.reject(metaRejected("Campaign not found."));
    const adSets = [...store.adSets.values()].filter(
      (s) => s.campaignId === campaignId,
    );
    const ids = new Set(adSets.map((s) => s.id));
    return Promise.resolve({
      campaign,
      adSets,
      ads: [...store.ads.values()].filter((a) => ids.has(a.adSetId)),
    });
  }

  object(_token: string, id: string): Promise<AdObject> {
    const campaign = store.campaigns.get(id);
    if (campaign) {
      return Promise.resolve({
        id,
        type: "campaign",
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effectiveStatus,
        accountId: ACCOUNT,
        campaignId: id,
        dailyBudget: campaign.dailyBudget,
      });
    }
    const adSet = store.adSets.get(id);
    if (adSet) {
      return Promise.resolve({
        id,
        type: "adset",
        name: adSet.name,
        status: adSet.status,
        effectiveStatus: adSet.effectiveStatus,
        accountId: ACCOUNT,
        campaignId: adSet.campaignId,
        dailyBudget: adSet.dailyBudget,
      });
    }
    const ad = store.ads.get(id);
    if (ad) {
      return Promise.resolve({
        id,
        type: "ad",
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effectiveStatus,
        accountId: ACCOUNT,
        campaignId: store.adSets.get(ad.adSetId)?.campaignId ?? null,
        dailyBudget: null,
      });
    }
    if (id === "999999999") {
      return Promise.resolve({
        id,
        type: "campaign",
        name: "Someone else's campaign",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        accountId: "act_999",
        campaignId: id,
        dailyBudget: null,
      });
    }
    return Promise.reject(metaRejected("Object not found."));
  }

  pixelEvents(
    _token: string,
    _pixelId: string,
    sinceUnix: number,
  ): Promise<PixelEventCount[]> {
    const days = Math.max(
      1,
      Math.round((Date.now() / 1000 - sinceUnix) / 86_400),
    );
    return Promise.resolve([
      { event: "PageView", count: 412 * days },
      { event: "ViewContent", count: 96 * days },
      { event: "Lead", count: 7 * days },
      { event: "CompleteRegistration", count: 3 * days },
    ]);
  }

  searchTargeting(
    _token: string,
    _adAccountId: string,
    type: TargetingSearchType,
    query: string,
  ): Promise<TargetingOption[]> {
    const q = query.toLowerCase();
    const catalog: TargetingOption[] = [
      {
        key: "1035921",
        name: "Patna",
        type: "city",
        region: "Bihar",
        countryCode: "IN",
        audienceSize: 4_200_000,
      },
      {
        key: "1035707",
        name: "Gaya",
        type: "city",
        region: "Bihar",
        countryCode: "IN",
        audienceSize: 900_000,
      },
      {
        key: "1036090",
        name: "Muzaffarpur",
        type: "city",
        region: "Bihar",
        countryCode: "IN",
        audienceSize: 750_000,
      },
      {
        key: "1730",
        name: "Bihar",
        type: "region",
        region: null,
        countryCode: "IN",
        audienceSize: 38_000_000,
      },
      {
        key: "IN",
        name: "India",
        type: "country",
        region: null,
        countryCode: "IN",
        audienceSize: 400_000_000,
      },
      {
        key: "6003107902433",
        name: "Physician",
        type: "interest",
        region: null,
        countryCode: null,
        audienceSize: 12_000_000,
      },
      {
        key: "6003020834693",
        name: "Medicine",
        type: "interest",
        region: null,
        countryCode: null,
        audienceSize: 90_000_000,
      },
      {
        key: "6003397425735",
        name: "Health care",
        type: "interest",
        region: null,
        countryCode: null,
        audienceSize: 150_000_000,
      },
    ];
    return Promise.resolve(
      catalog.filter(
        (o) => o.type === type && o.name.toLowerCase().includes(q),
      ),
    );
  }

  createDraft(
    _token: string,
    input: CampaignDraftInput,
  ): Promise<CampaignDraftResult> {
    if (input.creative.link.includes("reject.example")) {
      return Promise.reject(metaRejected("The link in your ad isn't working."));
    }
    const next = () =>
      `1202900000000${String(++store.sequence).padStart(5, "0")}`;
    const now = new Date().toISOString();
    const campaignId = next();
    const adSetId = next();
    const adId = next();
    store.campaigns.set(campaignId, {
      id: campaignId,
      name: input.name,
      objective: input.objective,
      status: "PAUSED",
      effectiveStatus: "PAUSED",
      dailyBudget: null,
      lifetimeBudget: null,
      startTime: now,
      stopTime: null,
      createdTime: now,
    });
    store.adSets.set(adSetId, {
      id: adSetId,
      name: `${input.name} – Ad set`,
      campaignId,
      status: "PAUSED",
      effectiveStatus: "CAMPAIGN_PAUSED",
      optimizationGoal: input.adSet.optimizationGoal,
      billingEvent: input.adSet.billingEvent,
      dailyBudget: input.dailyBudget,
      lifetimeBudget: null,
      targeting: input.adSet.targeting,
      promotedObject: input.adSet.promotedObject,
    });
    store.ads.set(adId, {
      id: adId,
      name: `${input.name} – Ad`,
      adSetId,
      status: "PAUSED",
      effectiveStatus: "CAMPAIGN_PAUSED",
      creative: {
        id: `${adId}9`,
        title: input.creative.headline,
        body: input.creative.message,
        linkUrl: input.creative.link,
        imageUrl: input.creative.imageUrl,
        callToAction: input.creative.callToAction,
      },
    });
    return Promise.resolve({
      campaignId,
      adSetId,
      creativeId: `${adId}9`,
      adId,
    });
  }

  setStatus(_token: string, id: string, status: AdStatus): Promise<void> {
    const target =
      store.campaigns.get(id) ?? store.adSets.get(id) ?? store.ads.get(id);
    if (!target) return Promise.reject(metaRejected("Object not found."));
    target.status = status;
    target.effectiveStatus = status;
    return Promise.resolve();
  }

  setDailyBudget(
    _token: string,
    id: string,
    dailyBudget: number,
  ): Promise<void> {
    const target = store.campaigns.get(id) ?? store.adSets.get(id);
    if (!target) return Promise.reject(metaRejected("Object not found."));
    target.dailyBudget = dailyBudget;
    return Promise.resolve();
  }
}
