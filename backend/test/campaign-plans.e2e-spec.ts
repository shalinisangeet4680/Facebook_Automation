import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000091";
const OTHER = "9000000092";
const MISSING = "00000000-0000-4000-8000-000000000000";

type Json = Record<string, any>;

const plan = {
  name: "Clinic demo – Patna traffic",
  summary: "Send clinic owners in Patna to the demo page.",
  goal: "traffic",
  dailyBudget: 600,
  targeting: {
    cities: [{ key: "1035921", name: "Patna", radiusKm: 25 }],
    ageMin: 25,
    ageMax: 55,
    interests: [{ id: "6003397425735", name: "Health care" }],
  },
  creative: {
    primaryText: "Run a paperless clinic from your phone.",
    headline: "Free clinic demo",
    linkUrl: "https://arogyasystem.com/demo",
    imageUrl: "https://arogyasystem.com/og.png",
    callToAction: "LEARN_MORE",
  },
  reasons: {
    goal: "Visits to the demo page.",
    audience: "Clinic owners around Patna.",
    budget: "A fair test budget.",
    creative: "Shows the product.",
  },
};

describe("Campaign plans (REST)", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let other: Record<string, string>;

  async function signIn(phone: string) {
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
      body: { token: `EAA${"p".repeat(40)}` },
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
  const propose = async (body: unknown = plan) => {
    const res = await post(owner, "/campaign-plans", { plan: body });
    expect(res.statusCode).toBe(201);
    return res.body.id as string;
  };

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
    owner = await signIn(OWNER);
    other = await signIn(OTHER);
    const limits = await put(owner, "/settings/workspace", {
      name: "Arogya System",
      maxDailyBudget: 2000,
      monthlyBudget: null,
      targetCostPerResult: null,
    });
    expect(limits.statusCode).toBe(200);
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

  it("starts with no plans", async () => {
    const list = await get(owner, "/campaign-plans");
    expect(list.statusCode).toBe(200);
    expect(list.body.data).toEqual([]);
  });

  it("proposes, lists and gets a draft with its editing options", async () => {
    const id = await propose();
    const list = await get(owner, "/campaign-plans");
    expect(list.body.data as Json[]).toEqual([
      expect.objectContaining({
        id,
        status: "draft",
        source: "app",
        name: plan.name,
        goal: "traffic",
        dailyBudget: 600,
      }),
    ]);

    const detail = await get(owner, `/campaign-plans/${id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.body).toMatchObject({
      id,
      status: "draft",
      meta: null,
      adAccount: null,
      error: null,
      plan: { name: plan.name, dailyBudget: 600 },
      options: { currency: "INR", maxDailyBudget: 2000 },
    });
    const options = detail.body.options as Json;
    expect(options.goals).toEqual(
      expect.arrayContaining([
        { name: "traffic", needsPixel: false, instantForm: false },
      ]),
    );
    expect(options.callsToAction).toContain("LEARN_MORE");
  });

  it("edits a draft and validates every change", async () => {
    const id = await propose();
    const saved = await put(owner, `/campaign-plans/${id}`, {
      plan: { ...plan, dailyBudget: 900, name: "Clinic demo – edited" },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).toMatchObject({
      status: "draft",
      plan: { dailyBudget: 900, name: "Clinic demo – edited" },
    });

    const tooMuch = await put(owner, `/campaign-plans/${id}`, {
      plan: { ...plan, dailyBudget: 5000 },
    });
    expect(tooMuch.statusCode).toBe(422);
    expect(tooMuch.body.code).toBe("BUDGET_LIMIT");

    const broken = await put(owner, `/campaign-plans/${id}`, {
      plan: { ...plan, creative: { ...plan.creative, linkUrl: "http://x.y" } },
    });
    expect(broken.statusCode).toBe(400);
    const noPlan = await put(owner, `/campaign-plans/${id}`, {});
    expect(noPlan.statusCode).toBe(400);

    const detail = await get(owner, `/campaign-plans/${id}`);
    expect((detail.body.plan as Json).dailyBudget).toBe(900);
  });

  it("discards a draft and then refuses to change it", async () => {
    const id = await propose();
    const discarded = await post(owner, `/campaign-plans/${id}/discard`);
    expect(discarded.statusCode).toBe(200);
    expect(discarded.body.status).toBe("discarded");
    for (const res of [
      await put(owner, `/campaign-plans/${id}`, { plan }),
      await post(owner, `/campaign-plans/${id}/discard`),
      await post(owner, `/campaign-plans/${id}/create`),
      await post(owner, `/campaign-plans/${id}/launch`, { confirm: true }),
    ])
      expect(res.statusCode).toBe(409);
  });

  it("creates the campaign paused, then only launch is allowed", async () => {
    const id = await propose();
    const early = await post(owner, `/campaign-plans/${id}/launch`, {
      confirm: true,
    });
    expect(early.statusCode).toBe(409);

    const created = await post(owner, `/campaign-plans/${id}/create`);
    expect(created.statusCode).toBe(200);
    expect(created.body).toMatchObject({ status: "created", error: null });
    const meta = created.body.meta as Json;
    expect(meta.campaignId).toBeTruthy();
    expect(meta.adsManagerUrl).toContain(meta.campaignId);
    expect(created.body.adAccount).toMatchObject({ currency: "INR" });

    const live = await get(owner, `/ads/campaigns/${meta.campaignId}`);
    expect(live.statusCode).toBe(200);
    expect((live.body.campaign as Json).status).toBe("PAUSED");

    for (const res of [
      await put(owner, `/campaign-plans/${id}`, { plan }),
      await post(owner, `/campaign-plans/${id}/discard`),
      await post(owner, `/campaign-plans/${id}/create`),
    ])
      expect(res.statusCode).toBe(409);

    const audit = await get(owner, "/audit-events?limit=5");
    expect((audit.body.data as Json[])[0]).toMatchObject({
      action: "plan.created_in_meta",
      target: id,
      data: { campaignId: meta.campaignId, via: "app" },
    });
  });

  it("launches only with an explicit confirmation", async () => {
    const id = await propose();
    const created = await post(owner, `/campaign-plans/${id}/create`);
    const campaignId = (created.body.meta as Json).campaignId as string;

    for (const body of [
      undefined,
      {},
      { confirm: false },
      { confirm: "yes" },
    ]) {
      const res = await post(owner, `/campaign-plans/${id}/launch`, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await get(owner, `/campaign-plans/${id}`)).body.status).toBe(
      "created",
    );

    const launched = await post(owner, `/campaign-plans/${id}/launch`, {
      confirm: true,
    });
    expect(launched.statusCode).toBe(200);
    expect(launched.body.status).toBe("launched");
    const live = await get(owner, `/ads/campaigns/${campaignId}`);
    expect((live.body.campaign as Json).status).toBe("ACTIVE");

    const again = await post(owner, `/campaign-plans/${id}/launch`, {
      confirm: true,
    });
    expect(again.statusCode).toBe(409);
  });

  it("keeps the plan a draft with Meta's reason when creation fails", async () => {
    const id = await propose({
      ...plan,
      creative: { ...plan.creative, linkUrl: "https://reject.example/demo" },
    });
    const failed = await post(owner, `/campaign-plans/${id}/create`);
    expect(failed.statusCode).toBe(422);
    expect(failed.body.code).toBe("META_REJECTED");

    const detail = await get(owner, `/campaign-plans/${id}`);
    expect(detail.body).toMatchObject({
      status: "draft",
      meta: null,
      error: "The link in your ad isn't working.",
    });

    const fixed = await put(owner, `/campaign-plans/${id}`, { plan });
    expect(fixed.body.error).toBeNull();
    const created = await post(owner, `/campaign-plans/${id}/create`);
    expect(created.statusCode).toBe(200);
    expect(created.body).toMatchObject({ status: "created", error: null });
  });

  it("keeps plans to their own workspace", async () => {
    const id = await propose();
    for (const res of [
      await get(other, `/campaign-plans/${id}`),
      await put(other, `/campaign-plans/${id}`, { plan }),
      await post(other, `/campaign-plans/${id}/create`),
      await post(other, `/campaign-plans/${id}/launch`, { confirm: true }),
      await post(other, `/campaign-plans/${id}/discard`),
      await get(owner, `/campaign-plans/${MISSING}`),
    ])
      expect(res.statusCode).toBe(404);
    expect((await get(other, "/campaign-plans")).body.data).toEqual([]);
    expect((await get(owner, `/campaign-plans/${id}`)).body.status).toBe(
      "draft",
    );
    expect((await get(owner, "/campaign-plans/not-a-uuid")).statusCode).toBe(
      400,
    );
  });

  it("needs a signed-in user", async () => {
    const res = await call(app, "GET", "/api/v1/campaign-plans", {
      headers: { "x-client": "mobile" },
    });
    expect(res.statusCode).toBe(401);
  });
});
