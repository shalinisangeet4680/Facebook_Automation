import { ConfigService } from "@nestjs/config";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { OnboardingService } from "@modules/onboarding/application/onboarding.service";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000061";
const OTHER = "9000000062";
const COOKIE = "tv_meta_ads_state";
const WEB = "http://localhost:3200";
const CALLBACK = "/api/v1/meta/oauth/callback";

type Json = Record<string, any>;

describe("Meta Ads: Continue with Facebook", () => {
  let app: NestFastifyApplication;
  let db: Database;
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

  const start = (headers: Record<string, string>, body: Json = {}) =>
    call(app, "POST", "/api/v1/meta/oauth/start", {
      headers,
      body: { origin: WEB, ...body },
    });

  const follow = (url: string, cookies: Record<string, string> = {}) => {
    const parsed = new URL(url);
    return call(app, "GET", `${parsed.pathname}${parsed.search}`, { cookies });
  };

  const location = (res: { headers: Json }) =>
    new URL(res.headers.location as string);

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    owner = await signIn(OWNER);
    other = await signIn(OTHER);
  });

  afterAll(async () => {
    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.phone, [`+91${OWNER}`, `+91${OTHER}`]));
    for (const user of rows) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports Facebook sign-in as available", async () => {
    const res = await call(app, "GET", "/api/v1/meta/oauth/status", {
      headers: owner,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      facebookLogin: true,
      redirectUri: `${WEB}${CALLBACK}`,
    });
  });

  it("connects through Facebook and records the method", async () => {
    const started = await start(owner);
    expect(started.statusCode).toBe(200);
    const nonce = started.cookies[COOKIE]!;
    expect(nonce).toBeTruthy();
    const url = new URL(started.body.url as string);
    expect(`${url.origin}${url.pathname}`).toBe(`${WEB}${CALLBACK}`);
    expect(url.searchParams.get("code")).toBe("mock");

    const done = await follow(
      `${url.toString()}&granted_scopes=ads_management,business_management&denied_scopes=`,
      { [COOKIE]: nonce },
    );
    expect(done.statusCode).toBe(302);
    const back = location(done);
    expect(`${back.origin}${back.pathname}`).toBe(`${WEB}/setup/start`);
    expect(back.searchParams.get("connected")).toBe("facebook");
    expect(back.searchParams.get("error")).toBeNull();

    const connection = await call(app, "GET", "/api/v1/meta/connection", {
      headers: owner,
    });
    expect(connection.body).toMatchObject({
      status: "active",
      method: "facebook_login",
      systemUser: { name: "TreeVook AI" },
    });
    expect((connection.body.assets as unknown[]).length).toBeGreaterThan(0);

    const onboarding = await call(app, "GET", "/api/v1/onboarding", {
      headers: owner,
    });
    expect(
      (onboarding.body.steps as { id: string; status: string }[]).find(
        (s) => s.id === "connect_meta",
      )?.status,
    ).toBe("completed");
  });

  it("keeps an explicit next path and returns to the connect page once setup is done", async () => {
    const explicit = await start(owner, {
      next: "/setup/start?step=connect_meta",
    });
    const kept = await follow(explicit.body.url as string, {
      [COOKIE]: explicit.cookies[COOKIE]!,
    });
    const back = location(kept);
    expect(back.pathname).toBe("/setup/start");
    expect(back.searchParams.get("step")).toBe("connect_meta");
    expect(back.searchParams.get("connected")).toBe("facebook");

    const onboarding = app.get(OnboardingService);
    const real = onboarding.view.bind(onboarding);
    vi.spyOn(onboarding, "view").mockImplementation(async (id: string) => ({
      ...(await real(id)),
      isComplete: true,
    }));
    const finished = await start(owner, { next: "https://evil.example/x" });
    const res = await follow(finished.body.url as string, {
      [COOKIE]: finished.cookies[COOKIE]!,
    });
    expect(location(res).toString()).toBe(
      `${WEB}/setup/connect-meta?connected=facebook`,
    );
  });

  it("rejects a callback without the state cookie", async () => {
    const started = await start(other);
    const res = await follow(started.body.url as string);
    expect(res.statusCode).toBe(302);
    const back = location(res);
    expect(back.origin).toBe(WEB);
    expect(back.searchParams.get("error")).toBe(
      "This sign-in link expired. Start again from TreeVook.",
    );
    const connection = await call(app, "GET", "/api/v1/meta/connection", {
      headers: other,
    });
    expect(connection.body.status).toBe("not_connected");
  });

  it("rejects a forged state or a nonce from another sign-in", async () => {
    const forged = await call(app, "GET", `${CALLBACK}?code=mock&state=forged`);
    expect(forged.statusCode).toBe(302);
    expect(location(forged).toString()).toBe(
      `${WEB}/setup/connect-meta?error=${encodeURIComponent("This sign-in link expired. Start again from TreeVook.").replace(/%20/g, "+")}`,
    );

    const first = await start(other);
    const second = await start(other);
    const swapped = await follow(first.body.url as string, {
      [COOKIE]: second.cookies[COOKIE]!,
    });
    expect(location(swapped).searchParams.get("error")).toContain("expired");
  });

  it("never redirects to an unknown origin", async () => {
    const started = await start(other, { origin: "https://evil.example" });
    expect(started.statusCode).toBe(200);
    const url = new URL(started.body.url as string);
    expect(url.origin).toBe(WEB);
    const res = await follow(url.toString());
    expect(location(res).origin).toBe(WEB);
  });

  it("turns Meta's error parameters into a friendly message", async () => {
    const started = await start(other);
    const state = new URL(started.body.url as string).searchParams.get(
      "state",
    )!;
    const res = await call(
      app,
      "GET",
      `${CALLBACK}?error=access_denied&error_code=200&error_description=Permissions+error&error_reason=user_denied&state=${state}`,
      { cookies: { [COOKIE]: started.cookies[COOKIE]! } },
    );
    expect(res.statusCode).toBe(302);
    const back = location(res);
    expect(back.pathname).toBe("/setup/start");
    expect(back.searchParams.get("error")).toBe(
      "Facebook sign-in was cancelled.",
    );
  });

  it("explains when no ad account was shared", async () => {
    const started = await start(other);
    const url = new URL(started.body.url as string);
    url.searchParams.set("code", "mocknoads");
    const res = await follow(url.toString(), {
      [COOKIE]: started.cookies[COOKIE]!,
    });
    expect(location(res).searchParams.get("error")).toBe(
      "No ad account was shared. Continue with Facebook again and pick at least one ad account and one Page.",
    );
  });

  it("explains missing permissions", async () => {
    const started = await start(other);
    const url = new URL(started.body.url as string);
    url.searchParams.set("code", "mocknoperms");
    const res = await follow(url.toString(), {
      [COOKIE]: started.cookies[COOKIE]!,
    });
    expect(location(res).searchParams.get("error")).toContain(
      "Facebook didn't grant every permission we need: ads_management.",
    );
  });

  it("still records a pasted system user token", async () => {
    const res = await call(app, "POST", "/api/v1/meta/connection", {
      headers: other,
      body: { token: `EAA${"x".repeat(40)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.method).toBe("system_user_token");
  });

  it("reports Facebook sign-in as unavailable without a login configuration", async () => {
    const config = app.get(ConfigService);
    const real = config.get.bind(config);
    vi.spyOn(config, "get").mockImplementation(((key: string, opts?: never) =>
      key === "META_ADS_LOGIN_CONFIG_ID"
        ? undefined
        : real(key, opts)) as typeof config.get);
    const status = await call(app, "GET", "/api/v1/meta/oauth/status", {
      headers: owner,
    });
    expect(status.body.facebookLogin).toBe(false);
    const started = await start(owner);
    expect(started.statusCode).toBe(400);
    expect(started.cookies[COOKIE]).toBeUndefined();
  });
});
