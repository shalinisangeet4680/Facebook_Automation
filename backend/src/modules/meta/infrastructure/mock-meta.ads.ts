import { Injectable } from "@nestjs/common";

import { metaRejected } from "../domain/meta.errors";
import {
  AdCreativeSummary,
  AdObject,
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

const ACCOUNT = "act_1201000000000001";
export const MOCK_SECOND_ACCOUNT = "act_1201000000000002";
const PAGE = "1301000000000001";
const DAY_MS = 86_400_000;

interface MockLeadForm {
  id: string;
  pageId: string;
  name: string;
  status: string;
  locale: string;
  createdAt: number;
  everyMs: number;
  spec: LeadFormInput | null;
  adId: string | null;
}

export interface MockVideoUpload {
  videoId: string;
  adAccountId: string;
  fileUrl: string;
  name: string;
}

interface Store {
  accounts: Map<string, string>;
  videos: Map<string, MockVideoUpload>;
  resultFactor: Map<string, number>;
  campaigns: Map<string, CampaignSummary>;
  adSets: Map<string, AdSetSummary>;
  ads: Map<string, AdSummary>;
  pausedSince: Map<string, string>;
  forms: Map<string, MockLeadForm>;
  leadClockMs: number;
  sequence: number;
}

const SEEDED_FORM = "1401000000000001";
const FIRST_NAMES = [
  "Aarav",
  "Priya",
  "Rohan",
  "Sneha",
  "Vikram",
  "Ananya",
  "Rahul",
  "Kavya",
  "Arjun",
  "Meera",
  "Sanjay",
  "Pooja",
];
const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Singh",
  "Kumar",
  "Gupta",
  "Mishra",
  "Jha",
  "Prasad",
  "Sinha",
  "Das",
];
const CITIES = ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga"];

function linkCreative(
  id: string,
  fields: Partial<AdCreativeSummary> & { title: string | null; body: string },
): AdCreativeSummary {
  const imageUrl = fields.imageUrl ?? "https://arogyasystem.com/og.png";
  return {
    id,
    kind: "link",
    description: null,
    linkUrl: "https://arogyasystem.com/",
    imageHash: null,
    thumbnailUrl: imageUrl,
    callToAction: "LEARN_MORE",
    pageId: PAGE,
    instagramId: null,
    postId: null,
    ...fields,
    imageUrl,
  };
}

function seed(): Store {
  const created = new Date(Date.now() - 40 * DAY_MS).toISOString();
  const festive = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const pausedOn = new Date(Date.now() - 10 * DAY_MS)
    .toISOString()
    .slice(0, 10);
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
    [
      "120210000000000003",
      {
        id: "120210000000000003",
        name: "Diwali leads – Advantage budget",
        objective: "OUTCOME_LEADS",
        status: "PAUSED",
        effectiveStatus: "PAUSED",
        dailyBudget: 120_000,
        lifetimeBudget: null,
        startTime: festive,
        stopTime: null,
        createdTime: festive,
      },
    ],
    [
      "120210000000000201",
      {
        id: "120210000000000201",
        name: "Clinics – Website visits – Delhi",
        objective: "OUTCOME_TRAFFIC",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
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
    [
      "120220000000000003",
      {
        id: "120220000000000003",
        name: "Clinic owners – Bihar",
        campaignId: "120210000000000003",
        status: "ACTIVE",
        effectiveStatus: "CAMPAIGN_PAUSED",
        optimizationGoal: "OFFSITE_CONVERSIONS",
        billingEvent: "IMPRESSIONS",
        dailyBudget: null,
        lifetimeBudget: null,
        targeting: {
          age_min: 30,
          age_max: 60,
          geo_locations: { regions: [{ key: "1730", name: "Bihar" }] },
          flexible_spec: [
            { interests: [{ id: "6003107902433", name: "Physician" }] },
          ],
        },
        promotedObject: {
          pixel_id: "2519233968487265",
          custom_event_type: "LEAD",
        },
      },
    ],
    [
      "120220000000000004",
      {
        id: "120220000000000004",
        name: "Dentists – India",
        campaignId: "120210000000000003",
        status: "ACTIVE",
        effectiveStatus: "CAMPAIGN_PAUSED",
        optimizationGoal: "OFFSITE_CONVERSIONS",
        billingEvent: "IMPRESSIONS",
        dailyBudget: null,
        lifetimeBudget: null,
        targeting: {
          age_min: 25,
          age_max: 55,
          genders: [2],
          geo_locations: { countries: ["IN"] },
          flexible_spec: [
            { work_positions: [{ id: "108768179146852", name: "Dentist" }] },
          ],
        },
        promotedObject: {
          pixel_id: "2519233968487265",
          custom_event_type: "LEAD",
        },
      },
    ],
    [
      "120220000000000201",
      {
        id: "120220000000000201",
        name: "Delhi – Broad",
        campaignId: "120210000000000201",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        optimizationGoal: "LANDING_PAGE_VIEWS",
        billingEvent: "IMPRESSIONS",
        dailyBudget: 40_000,
        lifetimeBudget: null,
        targeting: {
          age_min: 25,
          age_max: 55,
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
      creative: linkCreative(`${id}9`, { title, body }),
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
    ad(
      "120230000000000004",
      "120220000000000003",
      "Diwali offer – image",
      "This Diwali, go paperless",
      "Free setup for clinics that join before Diwali. Book a 10-minute demo.",
    ),
    ad(
      "120230000000000005",
      "120220000000000004",
      "Dentist chairside – image",
      "Built for dental clinics",
      "Charts, X-ray notes and reminders for every patient.",
    ),
    ad(
      "120230000000000201",
      "120220000000000201",
      "Delhi clinics – image",
      "Clinic software for Delhi",
      "Book a free walkthrough for your Delhi clinic.",
    ),
  ]);
  ads.set("120230000000000006", {
    id: "120230000000000006",
    name: "Boosted post – clinic tour",
    adSetId: "120220000000000003",
    status: "ACTIVE",
    effectiveStatus: "CAMPAIGN_PAUSED",
    creative: {
      id: "1202300000000000069",
      kind: "post",
      title: null,
      body: "A quick tour of a paperless clinic in Patna. #clinic",
      description: null,
      linkUrl: "https://arogyasystem.com/",
      imageUrl: "https://arogyasystem.com/og.png",
      imageHash: null,
      thumbnailUrl: "https://arogyasystem.com/og.png",
      callToAction: "LEARN_MORE",
      pageId: PAGE,
      instagramId: null,
      postId: `${PAGE}_1029384756`,
    },
  });
  const forms = new Map<string, MockLeadForm>([
    [
      SEEDED_FORM,
      {
        id: SEEDED_FORM,
        pageId: PAGE,
        name: "Free demo – Instant form",
        status: "ACTIVE",
        locale: "EN_US",
        createdAt: Date.now() - 10 * DAY_MS,
        everyMs: 7 * 3_600_000,
        spec: null,
        adId: "120230000000000001",
      },
    ],
  ]);
  return {
    accounts: new Map([
      ...[...campaigns.keys()].map((id): [string, string] => [id, ACCOUNT]),
      ["120210000000000201", MOCK_SECOND_ACCOUNT],
    ]),
    videos: new Map(),
    resultFactor: new Map(),
    campaigns,
    adSets,
    ads,
    pausedSince: new Map([["120210000000000003", pausedOn]]),
    forms,
    leadClockMs: 0,
    sequence: 100,
  };
}

let store = seed();

export function resetMockAds(): void {
  store = seed();
}

export function advanceMockLeads(ms: number): void {
  store.leadClockMs += ms;
}

export function mockVideoUploads(): MockVideoUpload[] {
  return [...store.videos.values()];
}

export function backdateMockCampaign(campaignId: string, days: number): void {
  const campaign = store.campaigns.get(campaignId);
  if (!campaign) return;
  const when = new Date(Date.now() - days * DAY_MS).toISOString();
  campaign.createdTime = when;
  campaign.startTime = when;
}

export function setMockAdResults(adId: string, factor: number): void {
  store.resultFactor.set(adId, factor);
}

function accountOf(campaignId: string): string {
  return store.accounts.get(campaignId) ?? ACCOUNT;
}

export function mockLeadForm(formId: string): {
  name: string;
  status: string;
  spec: LeadFormInput | null;
} | null {
  const form = store.forms.get(formId);
  return form
    ? { name: form.name, status: form.status, spec: form.spec }
    : null;
}

function mockLead(form: MockLeadForm, slot: number): LeadRecord {
  const r = hash(`${form.id}:${slot}`);
  const first = FIRST_NAMES[Math.floor(r * FIRST_NAMES.length)]!;
  const last =
    LAST_NAMES[
      Math.floor(hash(`${form.id}:${slot}:last`) * LAST_NAMES.length)
    ]!;
  const city =
    CITIES[Math.floor(hash(`${form.id}:${slot}:city`) * CITIES.length)]!;
  const phone = `+9198${String(Math.floor(r * 1e8)).padStart(8, "0")}`;
  const asks = form.spec?.questions ?? ["FULL_NAME", "PHONE", "EMAIL", "CITY"];
  const fieldData: LeadRecord["fieldData"] = [];
  for (const q of asks) {
    if (q === "FULL_NAME")
      fieldData.push({ name: "full_name", values: [`${first} ${last}`] });
    if (q === "PHONE")
      fieldData.push({ name: "phone_number", values: [phone] });
    if (q === "EMAIL")
      fieldData.push({
        name: "email",
        values: [`${first}.${last}${slot}@example.com`.toLowerCase()],
      });
    if (q === "CITY") fieldData.push({ name: "city", values: [city] });
  }
  for (const q of form.spec?.customQuestions ?? [])
    fieldData.push({
      name: q.key,
      values: [
        q.options.length ? q.options[slot % q.options.length]! : "Next week",
      ],
    });
  const ad = form.adId ? store.ads.get(form.adId) : undefined;
  const adSet = ad ? store.adSets.get(ad.adSetId) : undefined;
  const campaign = adSet ? store.campaigns.get(adSet.campaignId) : undefined;
  return {
    id: `${form.id.slice(-6)}${String(slot).padStart(6, "0")}`,
    formId: form.id,
    createdTime: new Date(form.createdAt + slot * form.everyMs).toISOString(),
    fieldData,
    adId: ad?.id ?? null,
    adName: ad?.name ?? null,
    adSetId: adSet?.id ?? null,
    adSetName: adSet?.name ?? null,
    campaignId: campaign?.id ?? null,
    campaignName: campaign?.name ?? null,
  };
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
    case "last_90d":
      return { from: back(90), to: back(1) };
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

function liveOn(entity: { id: string; status: string }, day: string) {
  if (entity.status === "ACTIVE") return true;
  const since = store.pausedSince.get(entity.id);
  return since !== undefined && day < since;
}

function adDay(
  ad: AdSummary,
  adSet: AdSetSummary,
  campaign: CampaignSummary,
  day: string,
): Totals {
  const live = liveOn(campaign, day) && liveOn(adSet, day) && liveOn(ad, day);
  const created = campaign.createdTime.slice(0, 10);
  if (!live || day < created) {
    return { spend: 0, impressions: 0, reach: 0, linkClicks: 0, actions: {} };
  }
  const siblings = [...store.ads.values()].filter(
    (a) => a.adSetId === adSet.id && liveOn(a, day),
  );
  const liveSets = [...store.adSets.values()].filter(
    (s) => s.campaignId === campaign.id && liveOn(s, day),
  );
  const budget =
    campaign.dailyBudget !== null
      ? campaign.dailyBudget / Math.max(liveSets.length, 1)
      : (adSet.dailyBudget ?? 0);
  const share = 1 / Math.max(siblings.length, 1);
  const r = hash(`${ad.id}:${day}`);
  const spend =
    Math.round((budget / 100) * share * (0.88 + r * 0.12) * 100) / 100;
  const impressions = Math.round(spend * (38 + r * 10));
  const linkClicks = Math.round(impressions * (0.009 + r * 0.008));
  const actions: Record<string, number> = {
    link_click: linkClicks,
    landing_page_view: Math.round(linkClicks * 0.72),
  };
  if (campaign.objective === "OUTCOME_LEADS") {
    actions.lead = Math.round(
      (spend / (150 + r * 90)) * (store.resultFactor.get(ad.id) ?? 1),
    );
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
      if (accountOf(campaign.id) !== adAccountId) continue;
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
    return Promise.resolve(
      [...store.campaigns.values()]
        .filter((c) => accountOf(c.id) === adAccountId)
        .sort((a, b) => b.createdTime.localeCompare(a.createdTime)),
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

  adSets(_token: string, adAccountId: string): Promise<AdSetSummary[]> {
    return Promise.resolve(
      [...store.adSets.values()].filter(
        (s) => accountOf(s.campaignId) === adAccountId,
      ),
    );
  }

  ad(_token: string, adId: string): Promise<AdSummary> {
    const ad = store.ads.get(adId);
    return ad
      ? Promise.resolve(ad)
      : Promise.reject(metaRejected("Ad not found."));
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
        accountId: accountOf(id),
        campaignId: id,
        dailyBudget: campaign.dailyBudget,
        lifetimeBudget: campaign.lifetimeBudget,
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
        accountId: accountOf(adSet.campaignId),
        campaignId: adSet.campaignId,
        dailyBudget: adSet.dailyBudget,
        lifetimeBudget: adSet.lifetimeBudget,
      });
    }
    const ad = store.ads.get(id);
    if (ad) {
      const campaignId = store.adSets.get(ad.adSetId)?.campaignId ?? null;
      return Promise.resolve({
        id,
        type: "ad",
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effectiveStatus,
        accountId: campaignId ? accountOf(campaignId) : ACCOUNT,
        campaignId,
        dailyBudget: null,
        lifetimeBudget: null,
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
        lifetimeBudget: null,
      });
    }
    return Promise.reject(metaRejected("Object not found."));
  }

  pixelEvents(
    token: string,
    _pixelId: string,
    sinceUnix: number,
  ): Promise<PixelEventCount[]> {
    const days = Math.max(
      1,
      Math.round((Date.now() / 1000 - sinceUnix) / 86_400),
    );
    if (token.includes("quietpixel")) {
      return Promise.resolve(
        days <= 1
          ? []
          : [
              { event: "PageView", count: 180 },
              { event: "ViewContent", count: 22 },
            ],
      );
    }
    return Promise.resolve([
      { event: "PageView", count: 412 * days },
      { event: "ViewContent", count: 96 * days },
      { event: "Lead", count: 7 * days },
      { event: "CompleteRegistration", count: 3 * days },
    ]);
  }

  pixel(token: string, pixelId: string): Promise<PixelDetails> {
    return Promise.resolve({
      id: pixelId,
      name: "Arogya System Website",
      lastFiredTime: new Date(
        Date.now() - (token.includes("quietpixel") ? 3 * DAY_MS : 5 * 60_000),
      ).toISOString(),
    });
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
      {
        key: "107402372623035",
        name: "Doctor",
        type: "work_position",
        region: null,
        countryCode: null,
        audienceSize: null,
      },
      {
        key: "108768179146852",
        name: "Dentist",
        type: "work_position",
        region: null,
        countryCode: null,
        audienceSize: null,
      },
      {
        key: "6012903159383",
        name: "Healthcare and medical services",
        type: "industry",
        region: null,
        countryCode: null,
        audienceSize: 12_959_406,
      },
      {
        key: "6002714898572",
        name: "Small business owners",
        type: "behavior",
        region: null,
        countryCode: null,
        audienceSize: null,
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
    if (input.leadForm && input.leadForm.pageId !== PAGE)
      return Promise.reject(metaRejected("Page not found."));
    const leadFormId = input.leadForm
      ? `1402000000${String(++store.sequence).padStart(6, "0")}`
      : null;
    const campaignId = next();
    const adSetId = next();
    const entries = [
      { label: "", creative: input.creative },
      ...(input.variants ?? []),
    ];
    const many = entries.length > 1;
    const created = entries.map((e, i) => ({
      label: many ? e.label || String.fromCharCode(65 + i) : "",
      creative: e.creative,
      adId: next(),
    }));
    const adId = created[0]!.adId;
    if (input.leadForm && leadFormId)
      store.forms.set(leadFormId, {
        id: leadFormId,
        pageId: input.leadForm.pageId,
        name: input.leadForm.name,
        status: "ACTIVE",
        locale: input.leadForm.locale,
        createdAt: Date.now() + store.leadClockMs,
        everyMs: 20 * 60_000,
        spec: input.leadForm,
        adId,
      });
    store.accounts.set(campaignId, input.adAccountId);
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
    for (const entry of created)
      store.ads.set(entry.adId, {
        id: entry.adId,
        name: `${input.name} – ${entry.label ? `Version ${entry.label}` : "Ad"}`,
        adSetId,
        status: "PAUSED",
        effectiveStatus: "CAMPAIGN_PAUSED",
        creative: mockCreative(`${entry.adId}9`, entry.creative, leadFormId),
      });
    return Promise.resolve({
      campaignId,
      adSetId,
      creativeId: `${adId}9`,
      adId,
      ads: created.map((e) => ({
        label: e.label,
        adId: e.adId,
        creativeId: `${e.adId}9`,
      })),
      ...(leadFormId ? { leadFormId } : {}),
    });
  }

  uploadVideo(
    _token: string,
    adAccountId: string,
    fileUrl: string,
    name: string,
  ): Promise<UploadedVideo> {
    if (fileUrl.includes("broken"))
      return Promise.reject(
        metaRejected(
          "Meta couldn't process this video. Use a standard MP4 (H.264) of at least 3 seconds and try again.",
        ),
      );
    const videoId = `1203000000${String(++store.sequence).padStart(6, "0")}`;
    store.videos.set(videoId, {
      videoId,
      adAccountId,
      fileUrl,
      name,
    });
    return Promise.resolve({
      videoId,
      thumbnailUrl: `https://scontent.example.com/v/${videoId}.jpg`,
    });
  }

  customAudiences(
    _token: string,
    adAccountId: string,
  ): Promise<CustomAudienceSummary[]> {
    if (adAccountId !== ACCOUNT) return Promise.resolve([]);
    return Promise.resolve([
      {
        id: "23851000000000001",
        name: "Website visitors – 30 days",
        subtype: "WEBSITE",
        approximateCount: 12_000,
      },
      {
        id: "23851000000000002",
        name: "Existing customers",
        subtype: "CUSTOM",
        approximateCount: 2_400,
      },
    ]);
  }

  setStatus(_token: string, id: string, status: AdStatus): Promise<void> {
    const target =
      store.campaigns.get(id) ?? store.adSets.get(id) ?? store.ads.get(id);
    if (!target) return Promise.reject(metaRejected("Object not found."));
    if (status === "PAUSED" && target.status === "ACTIVE") {
      store.pausedSince.set(id, new Date().toISOString().slice(0, 10));
    }
    if (status === "ACTIVE") store.pausedSince.delete(id);
    target.status = status;
    refreshDelivery();
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

  replaceCreative(
    _token: string,
    input: CreativeReplaceInput,
  ): Promise<{ creativeId: string }> {
    const ad = store.ads.get(input.adId);
    if (!ad) return Promise.reject(metaRejected("Ad not found."));
    const c = input.creative;
    if (c.link.includes("reject.example")) {
      return Promise.reject(metaRejected("The link in your ad isn't working."));
    }
    const creativeId = `1202400000000${String(++store.sequence).padStart(5, "0")}`;
    ad.creative = mockCreative(
      creativeId,
      {
        ...c,
        imageUrl:
          c.imageUrl ?? (c.imageHash ? null : (ad.creative?.imageUrl ?? null)),
      },
      c.leadFormId ?? null,
    );
    return Promise.resolve({ creativeId });
  }

  pageAccessToken(token: string, pageId: string): Promise<string> {
    if (pageId !== PAGE) return Promise.reject(metaRejected("Page not found."));
    return Promise.resolve(`page:${token}`);
  }

  leadForms(_pageToken: string, pageId: string): Promise<LeadFormSummary[]> {
    return Promise.resolve(
      [...store.forms.values()]
        .filter((f) => f.pageId === pageId)
        .map((f) => ({
          id: f.id,
          name: f.name,
          status: f.status,
          locale: f.locale,
          createdTime: new Date(f.createdAt).toISOString(),
          questions: [
            ...(
              f.spec?.questions ?? ["FULL_NAME", "PHONE", "EMAIL", "CITY"]
            ).map((type) => ({
              key: type === "PHONE" ? "phone_number" : type.toLowerCase(),
              label: type,
              type,
            })),
            ...(f.spec?.customQuestions ?? []).map((q) => ({
              key: q.key,
              label: q.label,
              type: "CUSTOM",
            })),
          ],
        })),
    );
  }

  leads(
    pageToken: string,
    formId: string,
    sinceUnix: number | null,
  ): Promise<LeadRecord[]> {
    if (pageToken.includes("noleads"))
      return Promise.reject(
        metaRejected(
          "(#200) The user hasn't authorized the application to perform this action. Requires leads_retrieval permission.",
          { metaCode: 200 },
        ),
      );
    const form = store.forms.get(formId);
    if (!form) return Promise.reject(metaRejected("Form not found."));
    const now = Date.now() + store.leadClockMs;
    const slots = Math.max(
      0,
      Math.floor((now - form.createdAt) / form.everyMs),
    );
    const out: LeadRecord[] = [];
    for (let slot = slots; slot >= 1 && out.length < 500; slot--) {
      const lead = mockLead(form, slot);
      if (
        sinceUnix !== null &&
        Date.parse(lead.createdTime) / 1000 <= sinceUnix
      )
        break;
      out.push(lead);
    }
    return Promise.resolve(out);
  }
}

function mockCreative(
  id: string,
  c: CreativeInput,
  leadFormId: string | null,
): AdCreativeSummary {
  const post = c.existingPost;
  return {
    id,
    kind: post ? "post" : c.videoId ? "video" : "link",
    title: post ? null : c.headline,
    body: post ? `Existing ${post.platform} post ${post.id}` : c.message,
    description: post ? null : c.description,
    linkUrl: c.link,
    imageUrl: c.imageUrl,
    imageHash: c.imageHash,
    thumbnailUrl: c.imageUrl,
    callToAction: c.callToAction,
    pageId: c.pageId,
    instagramId: c.instagramId,
    postId: post?.id ?? null,
    leadFormId,
    videoId: c.videoId ?? null,
  };
}

function refreshDelivery(): void {
  for (const campaign of store.campaigns.values()) {
    campaign.effectiveStatus = campaign.status;
  }
  for (const adSet of store.adSets.values()) {
    const campaign = store.campaigns.get(adSet.campaignId);
    adSet.effectiveStatus =
      adSet.status === "ACTIVE" && campaign?.status !== "ACTIVE"
        ? "CAMPAIGN_PAUSED"
        : adSet.status;
  }
  for (const ad of store.ads.values()) {
    const adSet = store.adSets.get(ad.adSetId);
    const campaign = adSet ? store.campaigns.get(adSet.campaignId) : undefined;
    ad.effectiveStatus =
      ad.status !== "ACTIVE"
        ? ad.status
        : campaign?.status !== "ACTIVE"
          ? "CAMPAIGN_PAUSED"
          : adSet?.status !== "ACTIVE"
            ? "ADSET_PAUSED"
            : "ACTIVE";
  }
}
