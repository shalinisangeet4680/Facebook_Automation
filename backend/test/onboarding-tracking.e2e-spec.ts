import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000051";
const QUIET = "9000000052";
const NOPIXEL = "9000000053";

type Json = Record<string, any>;

const basics = {
  websiteUrl: "https://arogyasystem.com",
  offer: "Clinic management app for small clinics and doctors",
  area: "Patna, Bihar",
  category: "Healthcare software",
  language: "Hinglish",
};

const goal = {
  goal: "leads",
  dailyBudget: 800,
  monthlyBudget: 20000,
  targetCostPerResult: 150,
};

describe("Onboarding and tracking check", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let quiet: Record<string, string>;
  let nopixel: Record<string, string>;

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
    const before = await onboarding(headers);
    expect(before.currentStep).toBe("connect_meta");
    const connected = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token },
    });
    expect(connected.statusCode).toBe(200);
    return headers;
  }

  const onboarding = async (headers: Record<string, string>) => {
    const res = await call(app, "GET", "/api/v1/onboarding", { headers });
    expect(res.statusCode).toBe(200);
    return res.body as Json;
  };

  const step = (view: Json, id: string) =>
    (view.steps as Json[]).find((s) => s.id === id)!;

  const tracking = async (headers: Record<string, string>) => {
    const res = await call(app, "GET", "/api/v1/ads/tracking", { headers });
    expect(res.statusCode).toBe(200);
    return res.body as Json;
  };

  const fit = (report: Json, name: string) =>
    (report.goals as Json[]).find((g) => g.goal === name)!;

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
    owner = await signIn(OWNER, `EAA${"x".repeat(40)}`);
    quiet = await signIn(QUIET, `EAA${"x".repeat(40)}quietpixel`);
    nopixel = await signIn(NOPIXEL, `EAA${"x".repeat(40)}nopixel`);
  });

  afterAll(async () => {
    for (const phone of [OWNER, QUIET, NOPIXEL]) {
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

  it("reports a healthy Pixel with event counts and goal fit", async () => {
    const report = await tracking(owner);
    expect(report).toMatchObject({
      selected: true,
      status: "healthy",
      reasons: [],
      fixes: [],
      warnings: [],
      pixel: { id: "2519233968487265", name: "Arogya System Website" },
    });
    expect(report.pixel.lastFiredTime).toBeTruthy();
    expect(report.totals.last24Hours).toBe(518);
    expect(report.totals.last7Days).toBe(518 * 7);
    expect((report.events as Json[])[0]).toEqual({
      event: "PageView",
      last24Hours: 412,
      last7Days: 412 * 7,
    });
    expect(fit(report, "traffic").ready).toBe(true);
    expect(fit(report, "leads").ready).toBe(true);
    expect(fit(report, "sales")).toMatchObject({
      ready: false,
      message: "No Purchase events in the last 7 days.",
    });
    expect(report.eventsManagerUrl).toContain(
      "events_manager2/list/pixel/2519233968487265",
    );
  });

  it("warns when the Pixel is quiet and has no conversions", async () => {
    const report = await tracking(quiet);
    expect(report.status).toBe("warning");
    expect(report.reasons).toEqual([
      "The Pixel hasn't received any events in the last 24 hours.",
      "No conversion events (Lead, Purchase, CompleteRegistration…) in the last 7 days.",
    ]);
    expect(report.fixes).toHaveLength(2);
    expect(report.totals).toEqual({ last24Hours: 0, last7Days: 202 });
    expect(fit(report, "leads")).toMatchObject({ ready: false });
    expect(fit(report, "leads").fix).toContain("thank-you page");
    expect(fit(report, "traffic").ready).toBe(true);
  });

  it("reports a missing dataset with a fix", async () => {
    const report = await tracking(nopixel);
    expect(report).toMatchObject({
      selected: false,
      pixel: null,
      status: "missing",
      events: [],
    });
    expect(report.fixes[0]).toContain("Choose one in Meta account");
  });

  it("starts at business basics once Meta and accounts are done", async () => {
    const view = await onboarding(owner);
    expect(view.totalCount).toBe(7);
    expect(view.completedCount).toBe(2);
    expect(view.currentStep).toBe("business_profile");
    expect(view.goal).toBeNull();
    expect(step(view, "connect_meta").completedAt).toBeTruthy();
    expect(step(view, "tracking_check")).toMatchObject({
      skippable: true,
      skipped: false,
      status: "upcoming",
    });
  });

  it("saves and loads the business basics", async () => {
    const bad = await call(app, "PUT", "/api/v1/settings/business", {
      headers: owner,
      body: { ...basics, websiteUrl: "arogyasystem" },
    });
    expect(bad.statusCode).toBe(400);
    const short = await call(app, "PUT", "/api/v1/settings/business", {
      headers: owner,
      body: { ...basics, offer: "x" },
    });
    expect(short.statusCode).toBe(400);

    const saved = await call(app, "PUT", "/api/v1/settings/business", {
      headers: owner,
      body: basics,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body.business).toEqual(basics);

    const settings = await call(app, "GET", "/api/v1/settings", {
      headers: owner,
    });
    expect((settings.body as Json).business).toEqual(basics);

    const view = await onboarding(owner);
    expect(step(view, "business_profile").status).toBe("completed");
    expect(view.currentStep).toBe("goal_budget");
  });

  it("accepts a business without a website", async () => {
    const res = await call(app, "PUT", "/api/v1/settings/business", {
      headers: nopixel,
      body: { ...basics, websiteUrl: null },
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as Json).business.websiteUrl).toBeNull();
  });

  it("writes the goal and budget into the guardrails", async () => {
    const tooLow = await call(app, "PUT", "/api/v1/settings/goal", {
      headers: owner,
      body: { ...goal, monthlyBudget: 500 },
    });
    expect(tooLow.statusCode).toBe(400);
    const unknown = await call(app, "PUT", "/api/v1/settings/goal", {
      headers: owner,
      body: { ...goal, goal: "followers" },
    });
    expect(unknown.statusCode).toBe(400);

    const res = await call(app, "PUT", "/api/v1/settings/goal", {
      headers: owner,
      body: goal,
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as Json).budget).toMatchObject({
      goal: "leads",
      maxDailyBudget: 800,
      monthlyBudget: 20000,
      targetCostPerResult: 150,
    });
    expect((res.body as Json).business).toEqual(basics);

    const overview = await call(app, "GET", "/api/v1/settings", {
      headers: owner,
    });
    expect((overview.body as Json).budget.maxDailyBudget).toBe(800);

    const view = await onboarding(owner);
    expect(view.goal).toBe("leads");
    expect(step(view, "goal_budget").status).toBe("completed");
    expect(step(view, "tracking_check")).toMatchObject({
      status: "completed",
      skipped: false,
    });
    expect(view.currentStep).toBe("campaign_plan");
  });

  it("keeps the basics and goal when the limits change in Settings", async () => {
    const res = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers: owner,
      body: {
        name: "Arogya System",
        maxDailyBudget: 900,
        monthlyBudget: 20000,
        targetCostPerResult: 150,
      },
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as Json).budget.goal).toBe("leads");
    expect((res.body as Json).business).toEqual(basics);
  });

  it("holds the tracking step until the Pixel fits the goal, or it's skipped", async () => {
    await call(app, "PUT", "/api/v1/settings/business", {
      headers: quiet,
      body: basics,
    });
    await call(app, "PUT", "/api/v1/settings/goal", {
      headers: quiet,
      body: goal,
    });
    const blocked = await onboarding(quiet);
    expect(blocked.currentStep).toBe("tracking_check");

    const wrong = await call(
      app,
      "POST",
      "/api/v1/onboarding/steps/launch/skip",
      { headers: quiet },
    );
    expect(wrong.statusCode).toBe(400);

    const skipped = await call(
      app,
      "POST",
      "/api/v1/onboarding/steps/tracking_check/skip",
      { headers: quiet },
    );
    expect(skipped.statusCode).toBe(200);
    expect(step(skipped.body, "tracking_check")).toMatchObject({
      status: "completed",
      skipped: true,
    });
    expect(skipped.body.currentStep).toBe("campaign_plan");

    const again = await onboarding(quiet);
    expect(step(again, "tracking_check").skipped).toBe(true);
  });

  it("passes the tracking step for a traffic goal without a Pixel", async () => {
    const res = await call(app, "PUT", "/api/v1/settings/goal", {
      headers: nopixel,
      body: { ...goal, goal: "traffic", monthlyBudget: null },
    });
    expect(res.statusCode).toBe(200);
    const view = await onboarding(nopixel);
    expect(step(view, "tracking_check").status).toBe("completed");
    expect(view.currentStep).toBe("campaign_plan");
  });

  it("completes the first campaign and launch steps from plans", async () => {
    const generated = await call(
      app,
      "POST",
      "/api/v1/campaign-plans/generate",
      {
        headers: owner,
        body: {
          goal: "leads",
          dailyBudget: 800,
          locations: { cities: [{ key: "1035921", name: "Patna" }] },
          offer: basics.offer,
          landingUrl: "https://arogyasystem.com/demo",
          creative: { imageUrl: "https://arogyasystem.com/og.png" },
        },
      },
    );
    expect(generated.statusCode).toBe(201);
    const planned = await onboarding(owner);
    expect(step(planned, "campaign_plan").status).toBe("completed");
    expect(planned.currentStep).toBe("launch");

    const detail = await call(
      app,
      "GET",
      `/api/v1/campaign-plans/${generated.body.id as string}`,
      { headers: owner },
    );
    expect((detail.body as Json).plan.creative.primaryText).toBeTruthy();

    const created = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${generated.body.id as string}/create`,
      { headers: owner },
    );
    expect(created.statusCode).toBe(200);
    const done = await onboarding(owner);
    expect(done.isComplete).toBe(true);
    expect(done.currentStep).toBeNull();
    expect(done.completedCount).toBe(7);
  });

  it("keeps each workspace's onboarding separate", async () => {
    const other = await onboarding(nopixel);
    expect(step(other, "campaign_plan").status).toBe("current");
    expect(step(other, "launch").status).toBe("upcoming");
    expect(other.goal).toBe("traffic");

    const settings = await call(app, "GET", "/api/v1/settings", {
      headers: nopixel,
    });
    expect((settings.body as Json).business.websiteUrl).toBeNull();
    expect((settings.body as Json).budget.goal).toBe("traffic");

    const quietView = await onboarding(quiet);
    expect(quietView.isComplete).toBe(false);
    expect(step(quietView, "campaign_plan").status).toBe("current");
  });
});
