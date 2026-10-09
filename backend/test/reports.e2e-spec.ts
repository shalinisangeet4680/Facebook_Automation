import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const PHONE = "9000000005";
const E164 = `+91${PHONE}`;

describe("Reports", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = [
      ...(await redis.keys("throttle:*")),
      ...(await redis.keys("reports:*")),
    ];
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    resetMockAds();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    await db.delete(otpChallenges).where(eq(otpChallenges.phone, E164));
    const mobile = { "x-client": "mobile" };
    await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: mobile,
      body: { phone: PHONE },
    });
    const signIn = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: mobile,
      body: { phone: PHONE, code: "123456" },
    });
    headers = {
      "x-client": "mobile",
      authorization: `Bearer ${signIn.body.accessToken as string}`,
    };
  });

  afterAll(async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.phone, E164),
    });
    if (user) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await db.delete(otpChallenges).where(eq(otpChallenges.phone, E164));
    await app.close();
  });

  it("needs a Meta connection", async () => {
    const res = await call(app, "GET", "/api/v1/reports/overview", { headers });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("META_NOT_CONNECTED");
  });

  it("summarises the period against the previous one", async () => {
    await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: `EAA${"r".repeat(40)}` },
    });
    await call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "Arogya",
        maxDailyBudget: 5000,
        monthlyBudget: null,
        targetCostPerResult: 200,
      },
    });
    const res = await call(
      app,
      "GET",
      "/api/v1/reports/overview?preset=last_7d",
      { headers },
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      currency: string;
      kpis: {
        spend: number;
        results: number;
        costPerResult: number;
        reach: number;
        ctr: number;
      };
      previousKpis: { spend: number };
      daily: { date: string; spend: number; results: number }[];
      campaigns: {
        name: string;
        results: number;
        resultType: string;
        status: string;
      }[];
      topAds: { results: number }[];
      targetCostPerResult: number;
      period: { since: string; until: string };
    };
    expect(body.currency).toBe("INR");
    expect(body.targetCostPerResult).toBe(200);
    expect(body.daily).toHaveLength(7);
    expect(body.daily[0]!.date).toBe(body.period.since);
    expect(body.kpis.spend).toBeGreaterThan(0);
    expect(body.kpis.results).toBeGreaterThan(0);
    expect(body.kpis.reach).toBeGreaterThan(0);
    expect(body.kpis.costPerResult).toBeCloseTo(
      body.kpis.spend / body.kpis.results,
      1,
    );
    expect(body.previousKpis.spend).toBeGreaterThan(0);
    const dailySpend = body.daily.reduce((s, d) => s + d.spend, 0);
    expect(dailySpend).toBeCloseTo(body.kpis.spend, 0);
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0]).toMatchObject({
      resultType: "lead",
      status: "ACTIVE",
    });
    expect(body.topAds.length).toBeGreaterThan(0);
  });

  it("supports month presets and rejects unknown ones", async () => {
    const month = await call(
      app,
      "GET",
      "/api/v1/reports/overview?preset=last_month",
      { headers },
    );
    expect(month.statusCode).toBe(200);
    expect((month.body.period as { since: string }).since.endsWith("-01")).toBe(
      true,
    );
    const bad = await call(
      app,
      "GET",
      "/api/v1/reports/overview?preset=yesterday",
      { headers },
    );
    expect(bad.statusCode).toBe(400);
  });
});
