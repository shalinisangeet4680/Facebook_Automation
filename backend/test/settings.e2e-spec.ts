import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const PHONE = "9000000004";
const E164 = `+91${PHONE}`;

describe("Settings", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
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

  it("starts with the platform limit and no targets", async () => {
    const res = await call(app, "GET", "/api/v1/settings", { headers });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      workspace: { name: "My business" },
      profile: { name: null, email: null, phone: E164 },
      budget: {
        currency: "INR",
        maxDailyBudget: 10000,
        platformMaxDailyBudget: 10000,
        monthlyBudget: null,
        targetCostPerResult: null,
      },
    });
  });

  it("updates the workspace, budget limit and targets", async () => {
    const res = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "Arogya System",
        maxDailyBudget: 3000,
        monthlyBudget: 30000,
        targetCostPerResult: 200,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.budget).toMatchObject({
      maxDailyBudget: 3000,
      monthlyBudget: 30000,
      targetCostPerResult: 200,
    });
    const me = await call(app, "GET", "/api/v1/me", { headers });
    expect((me.body.workspace as { name: string }).name).toBe("Arogya System");
    const connector = await call(app, "GET", "/api/v1/connector", { headers });
    expect(connector.body.maxDailyBudget).toBe(3000);
    const audit = await call(app, "GET", "/api/v1/audit-events", { headers });
    expect((audit.body.data as { action: string }[])[0]?.action).toBe(
      "settings.updated",
    );
  });

  it("refuses a limit above the platform limit and inconsistent budgets", async () => {
    const above = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "Arogya System",
        maxDailyBudget: 20000,
        monthlyBudget: null,
        targetCostPerResult: null,
      },
    });
    expect(above.statusCode).toBe(400);
    const monthly = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "Arogya System",
        maxDailyBudget: 3000,
        monthlyBudget: 1000,
        targetCostPerResult: null,
      },
    });
    expect(monthly.statusCode).toBe(400);
    const shortName = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "A",
        maxDailyBudget: 3000,
        monthlyBudget: null,
        targetCostPerResult: null,
      },
    });
    expect(shortName.statusCode).toBe(400);
  });

  it("updates the profile", async () => {
    const res = await call(app, "PUT", "/api/v1/settings/profile", {
      headers,
      body: { name: "Dr. Aashutosh", email: "Owner@Example.com" },
    });
    expect(res.body.profile).toMatchObject({
      name: "Dr. Aashutosh",
      email: "owner@example.com",
    });
    const bad = await call(app, "PUT", "/api/v1/settings/profile", {
      headers,
      body: { name: "X", email: "not-an-email" },
    });
    expect(bad.statusCode).toBe(400);
  });
});
