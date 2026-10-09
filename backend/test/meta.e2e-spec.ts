import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { metaConnections } from "@modules/meta/infrastructure/meta.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const PHONE = "9000000002";
const E164 = `+91${PHONE}`;
const token = (flag = "") => `EAA${"x".repeat(40)}${flag}`;

describe("Meta connection", () => {
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

  it("serves the guide and permission requirements", async () => {
    const res = await call(app, "GET", "/api/v1/meta/requirements", {
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect((res.body.steps as unknown[]).length).toBe(6);
    expect(
      (res.body.permissions as { name: string; level: string }[]).filter(
        (p) => p.level === "required",
      ),
    ).toHaveLength(5);
  });

  it("starts disconnected", async () => {
    const res = await call(app, "GET", "/api/v1/meta/connection", { headers });
    expect(res.body.status).toBe("not_connected");
  });

  it("rejects text that is not a Meta token", async () => {
    const res = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: "not-a-real-token-but-long-enough-to-pass-length" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("reports an invalid token", async () => {
    const res = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: token("invalid") },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("META_TOKEN_INVALID");
  });

  it("explains missing required permissions with checks", async () => {
    const res = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: token("noperms") },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("META_PERMISSIONS_MISSING");
    const details = res.body.details as {
      missing: { required: string[] };
      checks: { key: string; status: string }[];
    };
    expect(details.missing.required).toEqual(["ads_management"]);
    expect(details.checks.find((c) => c.key === "permissions")?.status).toBe(
      "failed",
    );
  });

  it("refuses a connection without a Facebook Page", async () => {
    const res = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: token("nopages") },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("META_ASSETS_MISSING");
  });

  it("connects, encrypts the token, discovers and auto-selects assets", async () => {
    const res = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: token() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("active");
    expect(res.body.tokenLast4).toBe("xxxx");
    const checks = res.body.checks as { key: string; status: string }[];
    expect(checks.every((c) => c.status === "passed")).toBe(true);
    const assets = res.body.assets as { kind: string; isPrimary: boolean }[];
    expect(assets.map((a) => a.kind).sort()).toEqual([
      "ad_account",
      "business",
      "dataset",
      "instagram",
      "page",
    ]);
    expect(assets.every((a) => a.isPrimary)).toBe(true);

    const user = await db.query.users.findFirst({
      where: eq(users.phone, E164),
    });
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerId, user!.id),
    });
    const stored = await db.query.metaConnections.findFirst({
      where: eq(metaConnections.workspaceId, ws!.id),
    });
    expect(stored!.tokenCiphertext.startsWith("v1.")).toBe(true);
    expect(stored!.tokenCiphertext).not.toContain(token());
  });

  it("never returns the token itself", async () => {
    const res = await call(app, "GET", "/api/v1/meta/connection", { headers });
    expect(JSON.stringify(res.body)).not.toContain(token());
  });

  it("rejects selecting an asset that is not in the account", async () => {
    const res = await call(app, "PUT", "/api/v1/meta/assets/selection", {
      headers,
      body: { adAccountId: "act_999" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("selects a known asset", async () => {
    const res = await call(app, "PUT", "/api/v1/meta/assets/selection", {
      headers,
      body: { adAccountId: "act_1201000000000001" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("records connection events in the audit log", async () => {
    const res = await call(app, "GET", "/api/v1/audit-events", { headers });
    const actions = (res.body.data as { action: string }[]).map(
      (e) => e.action,
    );
    expect(actions).toContain("meta.connected");
    expect(actions).toContain("meta.assets_selected");
  });

  it("disconnects and deletes the stored token and assets", async () => {
    const del = await call(app, "DELETE", "/api/v1/meta/connection", {
      headers,
    });
    expect(del.statusCode).toBe(204);
    const after = await call(app, "GET", "/api/v1/meta/connection", {
      headers,
    });
    expect(after.body.status).toBe("not_connected");
    const assets = await call(app, "GET", "/api/v1/meta/assets", { headers });
    expect(assets.body.data).toEqual([]);
  });
});
