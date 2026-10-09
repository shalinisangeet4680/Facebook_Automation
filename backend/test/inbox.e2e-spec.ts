import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const PHONE = "9000000011";
const E164 = `+91${PHONE}`;

interface Suggestion {
  id: string;
  rule: string;
  entityId: string;
  action: { type: string; to?: number };
  status: string;
}

describe("Inbox", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let headers: Record<string, string>;

  const settings = (target: number) =>
    call(app, "PUT", "/api/v1/settings/workspace", {
      headers,
      body: {
        name: "Arogya",
        maxDailyBudget: 5000,
        monthlyBudget: null,
        targetCostPerResult: target,
      },
    });
  const inbox = async () =>
    (await call(app, "GET", "/api/v1/inbox", { headers })).body as {
      suggestions: Suggestion[];
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
    await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: `EAA${"i".repeat(40)}` },
    });
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

  it("suggests scaling a cheap ad set and applies the budget change", async () => {
    await settings(300);
    const run = await call(app, "POST", "/api/v1/inbox/refresh", { headers });
    expect(run.statusCode).toBe(200);
    const scale = (await inbox()).suggestions.find(
      (s) => s.rule === "scale_winner",
    )!;
    expect(scale).toMatchObject({
      entityId: "120220000000000001",
      action: { type: "set_daily_budget", to: 960 },
    });

    const again = await call(app, "POST", "/api/v1/inbox/refresh", { headers });
    expect(again.body.created).toBe(0);

    const applied = await call(
      app,
      "POST",
      `/api/v1/inbox/suggestions/${scale.id}/apply`,
      { headers },
    );
    expect(applied.body.status).toBe("applied");
    const twice = await call(
      app,
      "POST",
      `/api/v1/inbox/suggestions/${scale.id}/apply`,
      { headers },
    );
    expect(twice.statusCode).toBe(409);
    const audit = await call(app, "GET", "/api/v1/audit-events?limit=10", {
      headers,
    });
    const actions = (
      audit.body.data as { action: string; data: { to?: number } }[]
    ).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(["ads.budget_changed", "suggestion.applied"]),
    );
  });

  it("warns when a whole ad set is above target, and dismissed ones stay quiet", async () => {
    await settings(50);
    await call(app, "POST", "/api/v1/inbox/refresh", { headers });
    const found = (await inbox()).suggestions.filter(
      (s) => s.rule === "above_target",
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.action.type).toBe("none");
    const dismissed = await call(
      app,
      "POST",
      `/api/v1/inbox/suggestions/${found[0]!.id}/dismiss`,
      { headers },
    );
    expect(dismissed.body.status).toBe("dismissed");
    const noAction = await call(
      app,
      "POST",
      `/api/v1/inbox/suggestions/${found[0]!.id}/apply`,
      { headers },
    );
    expect(noAction.statusCode).toBe(409);
    await call(app, "POST", "/api/v1/inbox/refresh", { headers });
    expect(
      (await inbox()).suggestions.filter((s) => s.rule === "above_target"),
    ).toHaveLength(0);
  });

  it("expires suggestions whose condition no longer holds", async () => {
    await settings(5000);
    const run = await call(app, "POST", "/api/v1/inbox/refresh", { headers });
    expect(run.body.open).toBe(0);
  });
});
