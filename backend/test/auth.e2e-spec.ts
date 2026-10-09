import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, sql } from "drizzle-orm";
import Redis from "ioredis";

import {
  otpChallenges,
  refreshTokens,
} from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const PHONE = "9000000001";
const E164 = `+91${PHONE}`;
const CODE = "123456";

const web = { "x-client": "web" };
const mobile = { "x-client": "mobile" };

describe("Auth flow", () => {
  let app: NestFastifyApplication;
  let db: Database;

  async function resetPhone() {
    await db.delete(otpChallenges).where(eq(otpChallenges.phone, E164));
  }

  async function signInWeb() {
    await resetPhone();
    await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: web,
      body: { phone: PHONE },
    });
    return call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: web,
      body: { phone: PHONE, code: CODE },
    });
  }

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
  });

  afterAll(async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.phone, E164),
    });
    if (user) {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await resetPhone();
    await app.close();
  });

  it("rejects numbers outside the early-access list", async () => {
    const res = await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: web,
      body: { phone: "9876500000" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("PHONE_NOT_ALLOWED");
  });

  it("rejects malformed numbers", async () => {
    const res = await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: web,
      body: { phone: "12345678901" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Enter a valid 10-digit Indian mobile number.",
    );
  });

  it("requires the X-Client header on state-changing requests", async () => {
    const res = await call(app, "POST", "/api/v1/auth/otp/request", {
      body: { phone: PHONE },
    });
    expect(res.statusCode).toBe(403);
  });

  it("issues an OTP and enforces the resend cooldown", async () => {
    await resetPhone();
    const first = await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: web,
      body: { phone: PHONE },
    });
    expect(first.statusCode).toBe(200);
    expect(first.body).toMatchObject({
      phone: "+91 90000 00001",
      expiresInSeconds: 600,
      resendInSeconds: 30,
    });
    const again = await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: web,
      body: { phone: PHONE },
    });
    expect(again.statusCode).toBe(429);
  });

  it("counts down attempts on a wrong code", async () => {
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: web,
      body: { phone: PHONE, code: "000000" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("OTP_INVALID");
    expect(res.body.details).toEqual({ attemptsLeft: 4 });
  });

  it("signs in on the web with httpOnly cookies and no tokens in the body", async () => {
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: web,
      body: { phone: PHONE, code: CODE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body).toMatchObject({
      isNewUser: true,
      accessTokenExpiresIn: 900,
    });
    expect(res.cookies.access_token).toBeTruthy();
    expect(res.cookies.refresh_token).toBeTruthy();
    expect(res.cookies.has_session).toBe("1");
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const me = await call(app, "GET", "/api/v1/me", {
      cookies: { access_token: res.cookies.access_token! },
    });
    expect(me.statusCode).toBe(200);
    expect(me.body.user).toMatchObject({ phone: E164 });

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=5", {
      cookies: { access_token: res.cookies.access_token! },
    });
    expect(audit.statusCode).toBe(200);
    const events = audit.body.data as { action: string }[];
    expect(events[0]?.action).toBe("auth.signed_up");
  });

  it("does not accept the same code twice", async () => {
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: web,
      body: { phone: PHONE, code: CODE },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("OTP_EXPIRED");
  });

  it("accepts an empty JSON body and rejects malformed JSON", async () => {
    const empty = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { "x-client": "web", "content-type": "application/json" },
    });
    expect(empty.statusCode).toBe(401);
    const broken = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      headers: { "x-client": "web", "content-type": "application/json" },
      payload: "{not json",
    });
    expect(broken.statusCode).toBe(400);
    expect(JSON.parse(broken.body)).toMatchObject({
      code: "VALIDATION",
      message: "The request body is not valid JSON.",
    });
  });

  it("rejects /me without a session", async () => {
    const res = await call(app, "GET", "/api/v1/me");
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rotates the refresh token and detects reuse", async () => {
    const signIn = await signInWeb();
    const original = signIn.cookies.refresh_token!;

    const rotated = await call(app, "POST", "/api/v1/auth/refresh", {
      headers: web,
      cookies: { refresh_token: original },
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.cookies.refresh_token).toBeTruthy();
    expect(rotated.cookies.refresh_token).not.toBe(original);

    const raced = await call(app, "POST", "/api/v1/auth/refresh", {
      headers: web,
      cookies: { refresh_token: original },
    });
    expect(raced.statusCode).toBe(409);
    expect(raced.body.code).toBe("SESSION_REFRESHED");

    await db
      .update(refreshTokens)
      .set({ replacedAt: sql`now() - interval '1 minute'` })
      .where(
        sql`replaced_at is not null and user_id = (select id from users where phone = ${E164})`,
      );

    const reused = await call(app, "POST", "/api/v1/auth/refresh", {
      headers: web,
      cookies: { refresh_token: original },
    });
    expect(reused.statusCode).toBe(401);

    const afterTheft = await call(app, "POST", "/api/v1/auth/refresh", {
      headers: web,
      cookies: { refresh_token: rotated.cookies.refresh_token! },
    });
    expect(afterTheft.statusCode).toBe(401);
  });

  it("supports mobile clients with Bearer tokens in the body", async () => {
    await resetPhone();
    await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: mobile,
      body: { phone: PHONE },
    });
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: mobile,
      body: { phone: PHONE, code: CODE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.cookies.access_token).toBeUndefined();
    const accessToken = res.body.accessToken as string;
    const refreshToken = res.body.refreshToken as string;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const me = await call(app, "GET", "/api/v1/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(200);

    const refreshed = await call(app, "POST", "/api/v1/auth/refresh", {
      headers: mobile,
      body: { refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.body.refreshToken).toBeTruthy();
  });

  it("logs out and ends the session", async () => {
    const signIn = await signInWeb();
    const out = await call(app, "POST", "/api/v1/auth/logout", {
      headers: web,
      cookies: { access_token: signIn.cookies.access_token! },
    });
    expect(out.statusCode).toBe(204);
    expect(out.cookies.has_session).toBe("");
    const refresh = await call(app, "POST", "/api/v1/auth/refresh", {
      headers: web,
      cookies: { refresh_token: signIn.cookies.refresh_token! },
    });
    expect(refresh.statusCode).toBe(401);
  });
});
