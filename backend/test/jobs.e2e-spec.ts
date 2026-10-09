import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { MaintenanceService } from "@modules/maintenance/application/maintenance.service";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { WorkerModule } from "../src/worker.module";
import { call } from "./helpers";

const PHONE = "9000000003";
const E164 = `+91${PHONE}`;

describe("Background jobs", () => {
  let app: NestFastifyApplication;
  let worker: INestApplicationContext;
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
    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
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
    await worker.close();
    await app.close();
  });

  it("refuses an asset refresh before Meta is connected", async () => {
    const res = await call(app, "POST", "/api/v1/meta/assets/refresh", {
      headers,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("META_NOT_CONNECTED");
  });

  it("runs an asset refresh in the worker and reports progress", async () => {
    await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: `EAA${"y".repeat(40)}` },
    });
    const accepted = await call(app, "POST", "/api/v1/meta/assets/refresh", {
      headers,
    });
    expect(accepted.statusCode).toBe(202);
    const jobId = accepted.body.jobId as string;

    let status = "";
    let result: unknown = null;
    for (let i = 0; i < 50 && status !== "completed"; i++) {
      const res = await call(app, "GET", `/api/v1/jobs/${jobId}`, { headers });
      status = res.body.status as string;
      result = res.body.result;
      if (status !== "completed") await new Promise((r) => setTimeout(r, 200));
    }
    expect(status).toBe("completed");
    expect(result).toEqual({ assets: 5 });
  });

  it("hides jobs from other workspaces", async () => {
    const res = await call(app, "GET", "/api/v1/jobs/meta-sync__unknown-job", {
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it("checks stored tokens and cleans up expired records", async () => {
    const maintenance = worker.get(MaintenanceService);
    const health = await maintenance.checkTokens();
    expect(health.checked).toBeGreaterThanOrEqual(1);
    expect(health.invalid).toBe(0);
    const cleaned = await maintenance.cleanup();
    expect(cleaned).toEqual({
      otps: expect.any(Number),
      refreshTokens: expect.any(Number),
      idempotencyKeys: expect.any(Number),
    });
  });
});
