import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { creatives } from "@modules/creatives/infrastructure/creatives.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import {
  backdateMockCampaign,
  mockVideoUploads,
  resetMockAds,
  setMockAdResults,
} from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000081";
const OTHER = "9000000082";
const FIRST = "act_1201000000000001";
const SECOND = "act_1201000000000002";
const PAGE = "1301000000000001";
const PIXEL = "2519233968487265";
const VIDEO = "https://arogyasystem.com/media/clinic-tour.mp4";

type Json = Record<string, any>;

const reasons = {
  goal: "Leads from the instant form.",
  audience: "Clinic owners in Bihar.",
  budget: "A fair test budget.",
  creative: "A short tour of the app.",
};

const targeting = {
  regions: [{ key: "1730", name: "Bihar" }],
  ageMin: 28,
  ageMax: 55,
  interests: [{ id: "6003107902433", name: "Physician" }],
};

const videoPlan = {
  name: "Clinic tour video – Instant form",
  summary: "A video lead ad for clinic owners.",
  goal: "instant_leads",
  dailyBudget: 600,
  targeting,
  creative: {
    primaryText: "See a paperless clinic in 30 seconds.",
    headline: "Free clinic demo",
    linkUrl: "https://arogyasystem.com/",
    videoUrl: VIDEO,
    callToAction: "SIGN_UP",
  },
  reasons,
  leadForm: {
    name: "Clinic demo – Instant form",
    locale: "EN_US",
    intro: { headline: "Free clinic demo", description: null },
    questions: ["FULL_NAME", "PHONE"],
    customQuestions: [],
    privacyPolicyUrl: "https://arogyasystem.com/privacy",
    thankYou: {
      title: "Thanks!",
      body: "We'll call you soon.",
      button: {
        type: "website",
        text: "Visit website",
        url: "https://arogyasystem.com/",
      },
    },
  },
};

const brief = {
  goal: "leads",
  dailyBudget: 1000,
  locations: { regions: [{ key: "1730", name: "Bihar" }] },
  audienceNotes: "clinic owners interested in health care",
  offer: "Free 30-day trial of our clinic management app",
  landingUrl: "https://arogyasystem.com/demo",
  creative: { imageUrl: "https://arogyasystem.com/og.png" },
};

describe("Advanced ads: video, variants, saved audiences, ad accounts", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let other: Record<string, string>;
  let videoPlanId = "";
  let videoCampaign = "";
  let variantsPlanId = "";
  let variantsCampaign = "";
  let audienceId = "";
  let suggestionId = "";

  async function signIn(phone: string, token: string) {
    await db
      .delete(otpChallenges)
      .where(eq(otpChallenges.phone, `+91${phone}`));
    const mobile = { "x-client": "mobile" };
    await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: mobile,
      body: { phone },
    });
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: mobile,
      body: { phone, code: "123456" },
    });
    const headers = {
      "x-client": "mobile",
      authorization: `Bearer ${res.body.accessToken as string}`,
    };
    const connected = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token },
    });
    expect(connected.statusCode).toBe(200);
    return headers;
  }

  const get = (headers: Record<string, string>, url: string) =>
    call(app, "GET", `/api/v1${url}`, { headers });
  const post = (headers: Record<string, string>, url: string, body?: unknown) =>
    call(app, "POST", `/api/v1${url}`, { headers, body });
  const put = (headers: Record<string, string>, url: string, body?: unknown) =>
    call(app, "PUT", `/api/v1${url}`, { headers, body });
  const campaign = async (id: string) =>
    (await get(owner, `/ads/campaigns/${id}`)).body as Json;

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    resetMockAds();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    owner = await signIn(OWNER, `EAA${"m".repeat(30)}multiaccount`);
    other = await signIn(OTHER, `EAA${"x".repeat(40)}`);
    const selected = await put(owner, "/meta/assets/selection", {
      adAccountId: FIRST,
      pageId: PAGE,
      datasetId: PIXEL,
    });
    expect(selected.statusCode).toBe(200);
    for (const headers of [owner, other]) {
      const limits = await put(headers, "/settings/workspace", {
        name: "Arogya System",
        maxDailyBudget: 5000,
        monthlyBudget: null,
        targetCostPerResult: null,
      });
      expect(limits.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    for (const phone of [OWNER, OTHER]) {
      const user = await db.query.users.findFirst({
        where: eq(users.phone, `+91${phone}`),
      });
      if (user) {
        await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
        await db.delete(users).where(eq(users.id, user.id));
      }
      await db
        .delete(otpChallenges)
        .where(eq(otpChallenges.phone, `+91${phone}`));
    }
    await app.close();
  });

  it("creates a video lead ad: uploads the video, waits for Meta and builds video_data", async () => {
    const proposed = await post(owner, "/campaign-plans", { plan: videoPlan });
    expect(proposed.statusCode).toBe(201);
    videoPlanId = proposed.body.id as string;

    const created = await post(owner, `/campaign-plans/${videoPlanId}/create`);
    expect(created.statusCode).toBe(200);
    expect(created.body).toMatchObject({
      status: "created",
      adAccount: { id: FIRST, name: "Arogya System Ads", currency: "INR" },
      meta: { adAccountId: FIRST },
    });
    const meta = created.body.meta as Json;
    expect(meta.leadFormId).toBeTruthy();
    videoCampaign = meta.campaignId as string;

    const upload = mockVideoUploads().find((v) => v.fileUrl === VIDEO)!;
    expect(upload).toMatchObject({ adAccountId: FIRST });

    const detail = await campaign(videoCampaign);
    expect(detail.ads).toHaveLength(1);
    expect(detail.ads[0].creative).toMatchObject({
      kind: "video",
      editable: true,
      videoId: upload.videoId,
      callToAction: "SIGN_UP",
      leadFormId: meta.leadFormId,
      thumbnailUrl: expect.stringContaining(upload.videoId),
    });

    const edited = await put(
      owner,
      `/ads/ads/${meta.adId as string}/creative`,
      {
        primaryText: "A paperless clinic in 30 seconds.",
      },
    );
    expect(edited.statusCode).toBe(200);
    expect(edited.body.changed).toEqual(["primaryText"]);
    const after = await campaign(videoCampaign);
    expect(after.ads[0].creative).toMatchObject({
      kind: "video",
      videoId: upload.videoId,
      primaryText: "A paperless clinic in 30 seconds.",
    });
  });

  it("builds video plans from a video link and refuses private library videos", async () => {
    const generated = await post(owner, "/campaign-plans/generate", {
      ...brief,
      creative: { videoUrl: VIDEO },
    });
    expect(generated.statusCode).toBe(201);
    const plan = (
      await get(owner, `/campaign-plans/${generated.body.id as string}`)
    ).body.plan as Json;
    expect(plan.creative).toMatchObject({ videoUrl: VIDEO, imageUrl: null });

    const workspace = await db.query.users.findFirst({
      where: eq(users.phone, `+91${OWNER}`),
    });
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerId, workspace!.id),
    });
    const [video] = await db
      .insert(creatives)
      .values({
        workspaceId: ws!.id,
        name: "Clinic tour",
        source: "upload",
        kind: "video",
        durationSeconds: 12,
        storageKey: `ads-advanced-${Date.now()}.mp4`,
        mime: "video/mp4",
        width: 1080,
        height: 1080,
        bytes: 1000,
      })
      .returning();
    const local = await post(owner, "/campaign-plans/generate", {
      ...brief,
      creative: { creativeId: video!.id },
    });
    expect(local.statusCode).toBe(400);
    expect(local.body.message).toContain(
      "video isn't on a public https address",
    );
  });

  it("drafts three versions, lets the owner turn one off and creates one paused ad per version", async () => {
    const generated = await post(owner, "/campaign-plans/generate", brief);
    expect(generated.statusCode).toBe(201);
    variantsPlanId = generated.body.id as string;
    const detail = await get(owner, `/campaign-plans/${variantsPlanId}`);
    const plan = detail.body.plan as Json;
    expect(plan.variants).toHaveLength(2);
    expect(plan.variants[0]).toMatchObject({ enabled: true });

    const noVersions = await post(owner, "/campaign-plans/generate", {
      ...brief,
      variants: false,
    });
    const single = (
      await get(owner, `/campaign-plans/${noVersions.body.id as string}`)
    ).body.plan as Json;
    expect(single.variants).toEqual([]);

    const edited = {
      ...plan,
      variants: [
        { ...plan.variants[0], headline: "Paperless in a week" },
        { ...plan.variants[1], enabled: false },
      ],
    };
    const saved = await put(owner, `/campaign-plans/${variantsPlanId}`, {
      plan: edited,
    });
    expect(saved.statusCode).toBe(200);

    const created = await post(
      owner,
      `/campaign-plans/${variantsPlanId}/create`,
    );
    expect(created.statusCode).toBe(200);
    const meta = created.body.meta as Json;
    expect(meta.ads).toHaveLength(2);
    expect(meta.ads.map((a: Json) => a.label)).toEqual(["A", "B"]);
    variantsCampaign = meta.campaignId as string;

    const live = await campaign(variantsCampaign);
    expect(live.ads).toHaveLength(2);
    expect(new Set(live.ads.map((a: Json) => a.adSetId)).size).toBe(1);
    expect(live.ads.every((a: Json) => a.status === "PAUSED")).toBe(true);
    expect(live.ads.map((a: Json) => a.name)).toEqual([
      `${plan.name} – Version A`,
      `${plan.name} – Version B`,
    ]);
    expect(live.ads[1].creative.headline).toBe("Paperless in a week");
    expect(live.comparisons).toEqual([
      expect.objectContaining({
        adIds: meta.ads.map((a: Json) => a.adId),
        winnerId: null,
        note: expect.stringContaining("Not enough data"),
      }),
    ]);
  });

  it("picks a winner and suggests pausing the clearly worse version", async () => {
    const launched = await post(
      owner,
      `/campaign-plans/${variantsPlanId}/launch`,
      { confirm: true },
    );
    expect(launched.statusCode).toBe(200);
    const meta = (await get(owner, `/campaign-plans/${variantsPlanId}`)).body
      .meta as Json;
    const [a, b] = meta.ads as Json[];
    backdateMockCampaign(variantsCampaign, 10);
    setMockAdResults(b!.adId as string, 0.3);

    const live = await campaign(variantsCampaign);
    expect(live.comparisons[0]).toMatchObject({
      winnerId: a!.adId,
      basis: "cost_per_result",
    });

    const refreshed = await post(owner, "/inbox/refresh");
    expect(refreshed.statusCode).toBe(200);
    const inbox = (await get(owner, "/inbox")).body as Json;
    const loser = (inbox.suggestions as Json[]).find(
      (s) => s.rule === "variant_loser",
    )!;
    expect(loser).toMatchObject({
      entityId: b!.adId,
      title: "Variant B is clearly worse — pause it",
      action: { type: "pause", id: b!.adId },
    });
    suggestionId = loser.id as string;

    const foreign = await post(
      other,
      `/inbox/suggestions/${suggestionId}/apply`,
    );
    expect(foreign.statusCode).toBe(404);

    const applied = await post(
      owner,
      `/inbox/suggestions/${suggestionId}/apply`,
    );
    expect(applied.statusCode).toBe(200);
    expect(applied.body.status).toBe("applied");
    const after = await campaign(variantsCampaign);
    const ads = new Map(
      (after.ads as Json[]).map((ad) => [ad.id as string, ad]),
    );
    expect(ads.get(b!.adId)!.status).toBe("PAUSED");
    expect(ads.get(a!.adId)!.status).toBe("ACTIVE");
  });

  it("saves, edits and deletes audiences, and builds plans from one", async () => {
    const invalid = await post(owner, "/ads/audiences", {
      name: "Bad ages",
      targeting: { ...targeting, ageMin: 60, ageMax: 30 },
    });
    expect(invalid.statusCode).toBe(400);

    const created = await post(owner, "/ads/audiences", {
      name: "Bihar doctors",
      targeting: {
        ...targeting,
        genders: "female",
        customAudiences: [
          { id: "23851000000000001", name: "Website visitors – 30 days" },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    audienceId = created.body.id as string;
    expect(created.body.targeting).toMatchObject({
      regions: [{ key: "1730", name: "Bihar" }],
      cities: [],
      genders: "female",
    });

    const duplicate = await post(owner, "/ads/audiences", {
      name: "Bihar doctors",
      targeting,
    });
    expect(duplicate.statusCode).toBe(409);

    const renamed = await put(owner, `/ads/audiences/${audienceId}`, {
      name: "Bihar women doctors",
      targeting: { ...(created.body.targeting as Json), ageMin: 30 },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.body).toMatchObject({
      name: "Bihar women doctors",
      targeting: { ageMin: 30 },
    });
    const list = await get(owner, "/ads/audiences");
    expect(list.body.data).toEqual([
      expect.objectContaining({ id: audienceId, name: "Bihar women doctors" }),
    ]);

    const custom = await get(owner, "/ads/custom-audiences");
    expect(custom.statusCode).toBe(200);
    expect((custom.body.data as Json[]).map((a) => a.id)).toContain(
      "23851000000000001",
    );

    const generated = await post(owner, "/campaign-plans/generate", {
      ...brief,
      locations: undefined,
      audienceId,
    });
    expect(generated.statusCode).toBe(201);
    const plan = (
      await get(owner, `/campaign-plans/${generated.body.id as string}`)
    ).body.plan as Json;
    expect(plan.targeting).toEqual(renamed.body.targeting);
    const created2 = await post(
      owner,
      `/campaign-plans/${generated.body.id as string}/create`,
    );
    expect(created2.statusCode).toBe(200);
    const sets = (
      await campaign((created2.body.meta as Json).campaignId as string)
    ).adSets as Json[];
    expect(sets[0]!.targeting).toMatchObject({
      age: "30–55",
      gender: "Women",
    });

    const missing = await post(owner, "/campaign-plans/generate", {
      ...brief,
      locations: undefined,
    });
    expect(missing.statusCode).toBe(400);

    for (const res of [
      await get(other, `/ads/audiences/${audienceId}`),
      await put(other, `/ads/audiences/${audienceId}`, {
        name: "Stolen",
        targeting,
      }),
      await call(app, "DELETE", `/api/v1/ads/audiences/${audienceId}`, {
        headers: other,
      }),
      await post(other, "/campaign-plans/generate", {
        ...brief,
        audienceId,
      }),
    ])
      expect(res.statusCode).toBe(404);
    expect((await get(other, "/ads/audiences")).body.data).toEqual([]);

    const removed = await call(
      app,
      "DELETE",
      `/api/v1/ads/audiences/${audienceId}`,
      { headers: owner },
    );
    expect(removed.statusCode).toBe(204);
    expect((await get(owner, `/ads/audiences/${audienceId}`)).statusCode).toBe(
      404,
    );
  });

  it("switches the active ad account and keeps plans bound to theirs", async () => {
    const before = await get(owner, "/ads/campaigns");
    expect(before.body).toMatchObject({
      currency: "INR",
      adAccount: { id: FIRST, name: "Arogya System Ads" },
    });
    const firstIds = (before.body.campaigns as Json[]).map((c) => c.id);
    expect(firstIds).toContain("120210000000000001");
    expect(firstIds).toContain(variantsCampaign);

    const unknown = await put(owner, "/meta/assets/ad-account", {
      adAccountId: "act_999",
    });
    expect(unknown.statusCode).toBe(404);

    const switched = await put(owner, "/meta/assets/ad-account", {
      adAccountId: SECOND,
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.body).toMatchObject({
      adAccount: { id: SECOND, name: "Arogya Clinics Delhi", currency: "USD" },
      changed: true,
      dataset: "switched",
      needsReview: false,
    });
    const assets = (switched.body.connection as Json).assets as Json[];
    const primary = (kind: string) =>
      assets.find((a) => a.kind === kind && a.isPrimary)?.externalId;
    expect(primary("ad_account")).toBe(SECOND);
    expect(primary("dataset")).toBe("2519233968487299");
    expect(primary("page")).toBe(PAGE);

    const after = await get(owner, "/ads/campaigns");
    expect(after.body).toMatchObject({
      currency: "USD",
      adAccount: { id: SECOND },
    });
    expect((after.body.campaigns as Json[]).map((c) => c.id)).toEqual([
      "120210000000000201",
    ]);
    expect(
      (await get(owner, `/ads/campaigns/${videoCampaign}`)).statusCode,
    ).toBe(404);
    expect(((await get(owner, "/inbox")).body as Json).suggestions).toEqual([]);
    const overview = await get(owner, "/reports/overview?preset=last_7d");
    expect(overview.statusCode).toBe(200);
    expect(overview.body.currency).toBe("USD");

    const plan = await get(owner, `/campaign-plans/${videoPlanId}`);
    expect(plan.body.adAccount).toMatchObject({ id: FIRST, currency: "INR" });
    expect((plan.body.options as Json).currency).toBe("INR");
    const launched = await post(
      owner,
      `/campaign-plans/${videoPlanId}/launch`,
      { confirm: true },
    );
    expect(launched.statusCode).toBe(200);
    expect(launched.body).toMatchObject({
      status: "launched",
      adAccount: { id: FIRST },
    });

    const fresh = await post(owner, "/campaign-plans", {
      plan: {
        ...videoPlan,
        goal: "traffic",
        leadForm: null,
        creative: {
          ...videoPlan.creative,
          videoUrl: null,
          imageUrl: "https://arogyasystem.com/og.png",
          callToAction: "LEARN_MORE",
        },
      },
    });
    const made = await post(
      owner,
      `/campaign-plans/${fresh.body.id as string}/create`,
    );
    expect(made.statusCode).toBe(200);
    expect(made.body.adAccount).toMatchObject({ id: SECOND, currency: "USD" });
    expect(
      ((await get(owner, "/ads/campaigns")).body.campaigns as Json[]).map(
        (c) => c.id,
      ),
    ).toContain((made.body.meta as Json).campaignId);

    const back = await put(owner, "/meta/assets/ad-account", {
      adAccountId: FIRST,
    });
    expect(back.body).toMatchObject({ changed: true, dataset: "switched" });
    expect(
      ((await get(owner, "/ads/campaigns")).body.campaigns as Json[]).map(
        (c) => c.id,
      ),
    ).toContain(videoCampaign);
  });

  it("keeps every workspace's plans and accounts to itself", async () => {
    expect(
      (await get(other, `/campaign-plans/${videoPlanId}`)).statusCode,
    ).toBe(404);
    expect(
      (
        await post(other, `/campaign-plans/${variantsPlanId}/launch`, {
          confirm: true,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await put(other, "/meta/assets/ad-account", { adAccountId: SECOND }))
        .statusCode,
    ).toBe(404);
    const list = await get(other, "/campaign-plans");
    expect(list.body.data).toEqual([]);
  });
});
