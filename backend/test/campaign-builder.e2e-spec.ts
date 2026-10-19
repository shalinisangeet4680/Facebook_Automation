import { Resvg } from "@resvg/resvg-js";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call, multipart } from "./helpers";

const OWNER = "9000000041";
const OTHER = "9000000042";

type Json = Record<string, any>;

const brief = {
  goal: "leads",
  dailyBudget: 800,
  locations: {
    regions: [{ key: "1730", name: "Bihar" }],
    cities: [{ key: "1035921", name: "Patna", radiusKm: 25 }],
  },
  audienceNotes: "clinic owners and doctors interested in health care",
  offer: "Free 30-day trial of our clinic management app",
  landingUrl: "https://arogyasystem.com/demo",
  creative: { imageUrl: "https://arogyasystem.com/og.png" },
};

describe("Campaign builder (generate a plan in the app)", () => {
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
      body: { token: `EAA${"x".repeat(40)}` },
    });
    expect(connected.statusCode).toBe(200);
    return headers;
  }

  const generate = (headers: Record<string, string>, body: unknown) =>
    call(app, "POST", "/api/v1/campaign-plans/generate", { headers, body });

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
    const limits = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers: owner,
      body: {
        name: "Arogya System",
        maxDailyBudget: 3000,
        monthlyBudget: null,
        targetCostPerResult: 200,
      },
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

  it("builds a complete draft plan from a short brief", async () => {
    const res = await generate(owner, brief);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      dailyBudget: 800,
      requestedDailyBudget: 800,
      budgetClamped: false,
      currency: "INR",
      ai: true,
      usedTemplate: false,
    });
    const id = res.body.id as string;

    const detail = await call(app, "GET", `/api/v1/campaign-plans/${id}`, {
      headers: owner,
    });
    expect(detail.statusCode).toBe(200);
    const plan = detail.body.plan as Json;
    expect(detail.body).toMatchObject({ status: "draft", source: "app" });
    expect(plan).toMatchObject({
      goal: "leads",
      conversionEvent: "LEAD",
      dailyBudget: 800,
      targeting: {
        regions: [{ key: "1730", name: "Bihar" }],
        cities: [{ key: "1035921", name: "Patna", radiusKm: 25 }],
        ageMin: 18,
        ageMax: 65,
      },
      creative: {
        linkUrl: "https://arogyasystem.com/demo",
        imageUrl: "https://arogyasystem.com/og.png",
        callToAction: "SIGN_UP",
      },
    });
    expect(plan.targeting.interests).toEqual([
      { id: "6003397425735", name: "Health care" },
    ]);
    expect(plan.name).toContain("Patna");
    expect(plan.creative.primaryText).toContain("Free 30-day trial");
    for (const key of ["goal", "audience", "budget", "creative"])
      expect((plan.reasons[key] as string).length).toBeGreaterThan(10);
    expect(plan.expectedResults).toContain("₹200");

    const list = await call(app, "GET", "/api/v1/campaign-plans", {
      headers: owner,
    });
    expect((list.body.data as Json[])[0]).toMatchObject({ id, source: "app" });

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=5", {
      headers: owner,
    });
    expect((audit.body.data as Json[])[0]).toMatchObject({
      action: "plan.proposed",
      target: id,
      data: { generated: true, ai: true, via: "app" },
    });

    const created = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${id}/create`,
      { headers: owner },
    );
    expect(created.statusCode).toBe(200);
    expect(created.body.status).toBe("created");
  });

  it("lowers a budget above the workspace limit and says why", async () => {
    const res = await generate(owner, {
      ...brief,
      goal: "awareness",
      dailyBudget: 9000,
      landingUrl: undefined,
      ageMin: 30,
      ageMax: 55,
      creative: undefined,
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      dailyBudget: 3000,
      requestedDailyBudget: 9000,
      budgetClamped: true,
    });
    const detail = await call(
      app,
      "GET",
      `/api/v1/campaign-plans/${res.body.id as string}`,
      { headers: owner },
    );
    const plan = detail.body.plan as Json;
    expect(plan.dailyBudget).toBe(3000);
    expect(plan.conversionEvent).toBeNull();
    expect(plan.targeting).toMatchObject({ ageMin: 30, ageMax: 55 });
    expect(plan.creative.linkUrl).toMatch(/^https:\/\/www\.facebook\.com\//);
    expect(plan.creative.imageUrl).toBeNull();
    expect(plan.creative.imageIdea).toBeTruthy();
    expect(plan.reasons.budget).toContain("above your limit");
  });

  it("rejects invalid briefs", async () => {
    const cases: [unknown, string][] = [
      [{ ...brief, dailyBudget: 0 }, "dailyBudget"],
      [{ ...brief, dailyBudget: -50 }, "dailyBudget"],
      [{ ...brief, goal: "followers" }, "goal"],
      [{ ...brief, offer: undefined }, "offer"],
      [{ ...brief, landingUrl: "http://arogyasystem.com" }, "https"],
      [{ ...brief, ageMin: 16 }, "ageMin"],
      [{ ...brief, ageMin: 50, ageMax: 30 }, "youngest age"],
      [{ ...brief, locations: { regions: [], cities: [] } }, "place"],
      [{ ...brief, goal: "sales", landingUrl: undefined }, "web page"],
      [{ ...brief, budget: 100 }, "budget"],
      [{ ...brief, locations: { regions: [{ key: "1730" }] } }, "name"],
    ];
    for (const [body, message] of cases) {
      const res = await generate(owner, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(JSON.stringify(res.body)).toContain(message);
    }
  });

  it("keeps workspaces apart", async () => {
    const mine = await generate(owner, brief);
    const planId = mine.body.id as string;
    const png = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#0f6b4a"/></svg>`,
    )
      .render()
      .asPng();
    const body = multipart(png, "image/png", "ad.png", "Ad");
    const uploaded = await app.inject({
      method: "POST",
      url: "/api/v1/creatives",
      headers: { ...owner, "content-type": body.contentType },
      payload: body.payload,
    });
    expect(uploaded.statusCode).toBe(201);
    const creativeId = (JSON.parse(uploaded.body) as { id: string }).id;

    const theirs = await call(app, "GET", `/api/v1/campaign-plans/${planId}`, {
      headers: other,
    });
    expect(theirs.statusCode).toBe(404);
    const list = await call(app, "GET", "/api/v1/campaign-plans", {
      headers: other,
    });
    expect((list.body.data as Json[]).some((p) => p.id === planId)).toBe(false);

    const borrowed = await generate(other, {
      ...brief,
      creative: { creativeId },
    });
    expect(borrowed.statusCode).toBe(404);

    const local = await generate(owner, { ...brief, creative: { creativeId } });
    expect(local.statusCode).toBe(400);
    expect(local.body.message).toContain("https");

    const own = await generate(other, { ...brief, dailyBudget: 9000 });
    expect(own.statusCode).toBe(201);
    expect(own.body).toMatchObject({ dailyBudget: 9000, budgetClamped: false });
  });

  it("needs a signed-in user", async () => {
    const res = await call(app, "POST", "/api/v1/campaign-plans/generate", {
      headers: { "x-client": "mobile" },
      body: brief,
    });
    expect(res.statusCode).toBe(401);
  });
});
