import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { and, eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import {
  users,
  workspaceMembers,
  workspaces,
} from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000043";
const OTHER = "9000000044";
const LEADS = "120210000000000001";
const DIWALI = "120210000000000003";
const LEADS_SET = "120220000000000001";
const DIWALI_SET = "120220000000000003";
const LEADS_AD = "120230000000000001";
const SECOND_AD = "120230000000000002";
const POST_AD = "120230000000000006";

interface Metrics {
  spend: number;
  results: number;
  resultType: string | null;
  costPerResult: number | null;
}
interface Row {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  budget: { level: string | null; type: string | null; amount: number | null };
  budgetEditable: boolean;
  metrics: Metrics;
}
interface Detail {
  canManage: boolean;
  campaign: Row & { adsManagerUrl: string };
  adSets: (Row & { targeting: { locations: string | null } })[];
  ads: {
    id: string;
    status: string;
    effectiveStatus: string;
    creative: {
      id: string | null;
      kind: string;
      editable: boolean;
      headline: string | null;
      primaryText: string | null;
      callToAction: string | null;
      imageUrl: string | null;
    };
  }[];
}

describe("Campaign manager", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let redis: Redis;
  let owner: Record<string, string>;
  let other: Record<string, string>;

  const signIn = async (phone: string) => {
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
    return {
      "x-client": "mobile",
      authorization: `Bearer ${res.body.accessToken as string}`,
    };
  };

  const settings = (
    headers: Record<string, string>,
    maxDailyBudget: number,
    monthlyBudget: number | null,
  ) =>
    call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "Arogya",
        maxDailyBudget,
        monthlyBudget,
        targetCostPerResult: null,
      },
    });

  const detail = async (id: string, preset = "last_7d") =>
    (
      await call(app, "GET", `/api/v1/ads/campaigns/${id}?preset=${preset}`, {
        headers: owner,
      })
    ).body as unknown as Detail;

  const status = (
    level: "campaigns" | "adsets" | "ads",
    id: string,
    value: string,
    headers = owner,
  ) =>
    call(app, "POST", `/api/v1/ads/${level}/${id}/status`, {
      headers,
      body: { status: value },
    });

  const budget = (
    level: "campaigns" | "adsets" | "ads",
    id: string,
    dailyBudget: unknown,
    headers = owner,
  ) =>
    call(app, "PUT", `/api/v1/ads/${level}/${id}/budget`, {
      headers,
      body: { dailyBudget },
    });

  const userId = async (phone: string) =>
    (await db.query.users.findFirst({ where: eq(users.phone, `+91${phone}`) }))!
      .id;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = [
      ...(await redis.keys("throttle:*")),
      ...(await redis.keys("reports:*")),
    ];
    if (keys.length) await redis.del(...keys);
    resetMockAds();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    owner = await signIn(OWNER);
    other = await signIn(OTHER);
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
    await redis.quit();
    await app.close();
  });

  it("needs a Meta connection", async () => {
    const res = await call(app, "GET", "/api/v1/ads/campaigns", {
      headers: owner,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("META_NOT_CONNECTED");
    await call(app, "POST", "/api/v1/meta/connection", {
      headers: owner,
      body: { token: `EAA${"m".repeat(40)}` },
    });
    await call(app, "POST", "/api/v1/meta/connection", {
      headers: other,
      body: { token: `EAA${"o".repeat(40)}otheraccount` },
    });
    await settings(owner, 5000, null);
  });

  it("lists live campaigns with budgets and period metrics", async () => {
    const res = await call(
      app,
      "GET",
      "/api/v1/ads/campaigns?preset=last_7d&status=all",
      { headers: owner },
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      currency: string;
      canManage: boolean;
      total: number;
      truncated: boolean;
      period: { since: string; until: string };
      campaigns: Row[];
    };
    expect(body.currency).toBe("INR");
    expect(body.canManage).toBe(true);
    expect(body.total).toBe(3);
    expect(body.truncated).toBe(false);
    const [first] = body.campaigns;
    expect(first).toMatchObject({
      id: LEADS,
      status: "ACTIVE",
      budget: { level: "adset", type: "daily", amount: 800 },
      budgetEditable: false,
      metrics: { resultType: "lead" },
    });
    expect(first!.metrics.spend).toBeGreaterThan(0);
    expect(first!.metrics.results).toBeGreaterThan(0);
    expect(first!.metrics.costPerResult).toBeCloseTo(
      first!.metrics.spend / first!.metrics.results,
      1,
    );
    expect(body.campaigns.find((c) => c.id === DIWALI)).toMatchObject({
      status: "PAUSED",
      budget: { level: "campaign", type: "daily", amount: 1200 },
      budgetEditable: true,
      metrics: { spend: 0 },
    });

    const paused = await call(
      app,
      "GET",
      "/api/v1/ads/campaigns?status=paused",
      { headers: owner },
    );
    expect((paused.body.campaigns as Row[]).map((c) => c.status)).toEqual([
      "PAUSED",
      "PAUSED",
    ]);
    const month = await call(
      app,
      "GET",
      "/api/v1/ads/campaigns?preset=last_30d",
      { headers: owner },
    );
    expect(
      (month.body.campaigns as Row[]).find((c) => c.id === DIWALI)!.metrics
        .spend,
    ).toBeGreaterThan(0);

    const bad = await call(
      app,
      "GET",
      "/api/v1/ads/campaigns?preset=yesterday",
      { headers: owner },
    );
    expect(bad.statusCode).toBe(400);
  });

  it("shows a campaign with its ad sets and ads", async () => {
    const body = await detail(DIWALI, "last_30d");
    expect(body.canManage).toBe(true);
    expect(body.campaign.adsManagerUrl).toContain(
      `selected_campaign_ids=${DIWALI}`,
    );
    expect(body.adSets).toHaveLength(2);
    expect(body.adSets[0]).toMatchObject({
      id: DIWALI_SET,
      budget: { level: "campaign", amount: null },
      budgetEditable: false,
      targeting: { locations: "Bihar" },
    });
    expect(body.adSets[0]!.metrics.spend).toBeGreaterThan(0);
    const post = body.ads.find((a) => a.id === POST_AD)!;
    expect(post.creative).toMatchObject({ kind: "post", editable: false });
    expect(body.ads.filter((a) => a.creative.editable)).toHaveLength(2);

    const leads = await detail(LEADS);
    expect(leads.adSets[0]).toMatchObject({
      id: LEADS_SET,
      budget: { level: "adset", type: "daily", amount: 800 },
      budgetEditable: true,
    });
    expect(leads.ads.map((a) => a.id)).toEqual([LEADS_AD, SECOND_AD]);

    const notCampaign = await call(
      app,
      "GET",
      `/api/v1/ads/campaigns/${LEADS_SET}`,
      { headers: owner },
    );
    expect(notCampaign.statusCode).toBe(404);
    const invalid = await call(app, "GET", "/api/v1/ads/campaigns/abc", {
      headers: owner,
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("pauses and resumes at every level", async () => {
    const pause = await status("campaigns", LEADS, "PAUSED");
    expect(pause.statusCode).toBe(200);
    expect(pause.body).toMatchObject({
      type: "campaign",
      status: "PAUSED",
      changed: true,
    });
    const again = await status("campaigns", LEADS, "PAUSED");
    expect(again.body.changed).toBe(false);
    expect((await detail(LEADS)).campaign.status).toBe("PAUSED");
    expect((await status("campaigns", LEADS, "ACTIVE")).body.status).toBe(
      "ACTIVE",
    );

    const set = await status("adsets", LEADS_SET, "PAUSED");
    expect(set.body).toMatchObject({ type: "adset", changed: true });
    const view = await detail(LEADS);
    expect(view.adSets[0]!.status).toBe("PAUSED");
    expect(view.ads[0]!.effectiveStatus).toBe("ADSET_PAUSED");
    await status("adsets", LEADS_SET, "ACTIVE");

    const ad = await status("ads", SECOND_AD, "PAUSED");
    expect(ad.body).toMatchObject({ type: "ad", status: "PAUSED" });
    expect(
      (await detail(LEADS)).ads.find((a) => a.id === SECOND_AD)!.status,
    ).toBe("PAUSED");
    await status("ads", SECOND_AD, "ACTIVE");

    expect((await status("adsets", LEADS, "PAUSED")).statusCode).toBe(404);
    expect((await status("ads", LEADS_AD, "DELETED")).statusCode).toBe(400);
    expect((await status("ads", "123456789012", "PAUSED")).statusCode).toBe(
      404,
    );
  });

  it("changes budgets where they live: the ad set, or the campaign for Advantage budgets", async () => {
    const setBudget = await budget("adsets", LEADS_SET, 1000);
    expect(setBudget.statusCode).toBe(200);
    expect(setBudget.body).toMatchObject({
      type: "adset",
      from: 800,
      to: 1000,
      currency: "INR",
      warnings: [],
    });
    expect((await detail(LEADS)).adSets[0]!.budget.amount).toBe(1000);

    const wrongLevel = await budget("campaigns", LEADS, 1000);
    expect(wrongLevel.statusCode).toBe(400);
    expect(wrongLevel.body.message).toContain("ad set budgets");

    const cbo = await budget("campaigns", DIWALI, 1500);
    expect(cbo.body).toMatchObject({ type: "campaign", from: 1200, to: 1500 });
    expect((await detail(DIWALI)).campaign.budget.amount).toBe(1500);

    const shared = await budget("adsets", DIWALI_SET, 500);
    expect(shared.statusCode).toBe(400);
    expect(shared.body.message).toContain("campaign budget");

    expect((await budget("ads", LEADS_AD, 500)).statusCode).toBe(404);
    expect((await budget("adsets", LEADS_SET, 0)).statusCode).toBe(400);
    expect((await budget("adsets", LEADS_SET, -5)).statusCode).toBe(400);
    expect((await budget("adsets", LEADS_SET, "lots")).statusCode).toBe(400);
  });

  it("enforces the daily limit and the monthly budget", async () => {
    await settings(owner, 2000, null);
    const over = await budget("adsets", LEADS_SET, 2500);
    expect(over.statusCode).toBe(422);
    expect(over.body.code).toBe("BUDGET_LIMIT");
    expect(over.body.message).toContain("₹2,000");

    await settings(owner, 2000, 5000);
    const month = await budget("adsets", LEADS_SET, 1500);
    expect(month.statusCode).toBe(422);
    expect(month.body.code).toBe("BUDGET_LIMIT");
    expect(month.body.message).toContain("monthly budget");
    expect((month.body.details as { reason: string }).reason).toBe(
      "over_monthly_budget",
    );

    const lower = await budget("adsets", LEADS_SET, 900);
    expect(lower.statusCode).toBe(200);
    expect((lower.body.warnings as string[])[0]).toContain("monthly budget");
    await settings(owner, 5000, null);
  });

  it("edits an ad by creating a new creative, and refuses post-based ads", async () => {
    const before = (await detail(LEADS)).ads.find((a) => a.id === LEADS_AD)!;
    const res = await call(app, "PUT", `/api/v1/ads/ads/${LEADS_AD}/creative`, {
      headers: owner,
      body: {
        primaryText: "Book a free demo of your paperless clinic.",
        headline: "Free demo clinic",
        callToAction: "SIGN_UP",
        imageUrl: "https://cdn.example.com/new.png",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.changed).toEqual([
      "primaryText",
      "headline",
      "callToAction",
      "image",
    ]);
    const after = (await detail(LEADS)).ads.find((a) => a.id === LEADS_AD)!;
    expect(after.creative).toMatchObject({
      headline: "Free demo clinic",
      primaryText: "Book a free demo of your paperless clinic.",
      callToAction: "SIGN_UP",
      imageUrl: "https://cdn.example.com/new.png",
    });
    expect(res.body.creativeId).not.toBe(before.creative.id);
    expect((await detail(LEADS)).ads[0]!.creative.id).toBe(res.body.creativeId);

    const post = await call(app, "PUT", `/api/v1/ads/ads/${POST_AD}/creative`, {
      headers: owner,
      body: { headline: "New" },
    });
    expect(post.statusCode).toBe(400);
    expect(post.body.message).toContain("existing Facebook or Instagram post");

    const same = await call(
      app,
      "PUT",
      `/api/v1/ads/ads/${LEADS_AD}/creative`,
      {
        headers: owner,
        body: { headline: "Free demo clinic" },
      },
    );
    expect(same.statusCode).toBe(400);
    const insecure = await call(
      app,
      "PUT",
      `/api/v1/ads/ads/${LEADS_AD}/creative`,
      { headers: owner, body: { imageUrl: "http://example.com/a.png" } },
    );
    expect(insecure.statusCode).toBe(400);
    const missing = await call(
      app,
      "PUT",
      `/api/v1/ads/ads/${LEADS_AD}/creative`,
      {
        headers: owner,
        body: { creativeId: "6f1c1c55-8f7a-4c1e-9d55-0a3d6c1f2b11" },
      },
    );
    expect(missing.statusCode).toBe(404);
    const notAnAd = await call(
      app,
      "PUT",
      `/api/v1/ads/ads/${LEADS_SET}/creative`,
      { headers: owner, body: { headline: "x" } },
    );
    expect(notAnAd.statusCode).toBe(404);
  });

  it("keeps workspaces apart", async () => {
    const list = await call(app, "GET", "/api/v1/ads/campaigns", {
      headers: other,
    });
    expect(list.statusCode).toBe(200);
    expect(list.body.campaigns).toEqual([]);
    const peek = await call(app, "GET", `/api/v1/ads/campaigns/${LEADS}`, {
      headers: other,
    });
    expect(peek.statusCode).toBe(404);
    expect((await status("campaigns", LEADS, "PAUSED", other)).statusCode).toBe(
      404,
    );
    expect((await budget("adsets", LEADS_SET, 100, other)).statusCode).toBe(
      404,
    );
    const edit = await call(
      app,
      "PUT",
      `/api/v1/ads/ads/${LEADS_AD}/creative`,
      {
        headers: other,
        body: { headline: "Hijacked" },
      },
    );
    expect(edit.statusCode).toBe(404);
    const mine = await detail(LEADS);
    expect(mine.campaign.status).toBe("ACTIVE");
    expect(mine.ads[0]!.creative.headline).toBe("Free demo clinic");
  });

  it("lets only owners and admins make changes", async () => {
    const id = await userId(OWNER);
    const membership = and(
      eq(workspaceMembers.userId, id),
      eq(workspaceMembers.role, "owner"),
    );
    await db.update(workspaceMembers).set({ role: "member" }).where(membership);
    try {
      const list = await call(app, "GET", "/api/v1/ads/campaigns", {
        headers: owner,
      });
      expect(list.body.canManage).toBe(false);
      const denied = await status("campaigns", LEADS, "PAUSED");
      expect(denied.statusCode).toBe(403);
      expect((await budget("adsets", LEADS_SET, 900)).statusCode).toBe(403);
    } finally {
      await db
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(eq(workspaceMembers.userId, id));
    }
    expect((await detail(LEADS)).campaign.status).toBe("ACTIVE");
  });

  it("records every change and clears cached reports", async () => {
    await call(app, "GET", "/api/v1/reports/overview?preset=last_7d", {
      headers: owner,
    });
    const me = await call(app, "GET", "/api/v1/me", { headers: owner });
    const workspaceId = (me.body.workspace as { id: string }).id;
    expect(await redis.keys(`reports:${workspaceId}:*`)).not.toHaveLength(0);
    await status("ads", SECOND_AD, "PAUSED");
    expect(await redis.keys(`reports:${workspaceId}:*`)).toHaveLength(0);

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=100", {
      headers: owner,
    });
    const events = audit.body.data as {
      action: string;
      target: string;
      data: { via?: string; from?: unknown; to?: unknown };
    }[];
    const actions = events.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "ads.paused",
        "ads.activated",
        "ads.budget_changed",
        "ads.creative_updated",
      ]),
    );
    const budgetEvent = events.find(
      (e) => e.action === "ads.budget_changed" && e.target === DIWALI,
    )!;
    expect(budgetEvent.data).toMatchObject({
      from: 1200,
      to: 1500,
      via: "app",
    });
    expect(
      events.filter((e) => e.target === LEADS && e.action === "ads.paused"),
    ).toHaveLength(1);
  });
});
