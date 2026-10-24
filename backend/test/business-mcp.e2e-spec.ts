import { createHash, randomBytes } from "crypto";

import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { BUSINESS_API } from "@modules/business/domain/ports/business-api";
import {
  MOCK_VERIFICATION_PIN,
  MockBusinessApi,
} from "@modules/business/infrastructure/mock-business.api";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import { oauthClients } from "@modules/oauth/infrastructure/oauth.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const PHONE = "9000000032";
const E164 = `+91${PHONE}`;
const APP_URL = "http://localhost:3200";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";

type Json = Record<string, any>;

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("Google Business tools over MCP", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let mock: MockBusinessApi;
  let session: Record<string, string>;
  let token: string;
  let readOnlyToken: string;
  let main: Json;
  let rpcId = 0;
  const clientIds: string[] = [];

  async function connectClient(allowWrite: boolean) {
    const reg = await call(app, "POST", "/oauth/register", {
      body: {
        client_name: "Claude",
        redirect_uris: [CALLBACK],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
    });
    expect(reg.statusCode).toBe(201);
    const clientId = reg.body.client_id as string;
    clientIds.push(clientId);
    const { verifier, challenge } = pkce();
    const decision = await call(app, "POST", "/api/v1/oauth/authorization", {
      headers: session,
      body: {
        response_type: "code",
        client_id: clientId,
        redirect_uri: CALLBACK,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "st",
        scope: "ads:read ads:write offline_access",
        resource: `${APP_URL}/mcp`,
        approve: true,
        allowWrite,
      },
    });
    expect(decision.statusCode).toBe(200);
    const code = new URL(decision.body.redirectTo as string).searchParams.get(
      "code",
    )!;
    const res = await app.inject({
      method: "POST",
      url: "/oauth/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: CALLBACK,
        client_id: clientId,
      }).toString(),
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { access_token: string }).access_token;
  }

  async function rpc(
    bearer: string,
    method: string,
    params: Record<string, unknown> = {},
  ) {
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      payload: { jsonrpc: "2.0", id: ++rpcId, method, params },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as Json;
  }

  async function tool(name: string, args: Record<string, unknown> = {}) {
    const res = await rpc(token, "tools/call", { name, arguments: args });
    const result = res.result as {
      isError?: boolean;
      content: { text: string }[];
    };
    const text = result.content[0]!.text;
    let data: Json = {};
    try {
      data = JSON.parse(text) as Json;
    } catch {
      data = {};
    }
    return { isError: result.isError ?? false, text, data };
  }

  async function twoStep(name: string, args: Record<string, unknown>) {
    const first = await tool(name, args);
    expect(first.data.status).toBe("confirmation_required");
    const applied = await tool(name, {
      ...args,
      confirm_token: first.data.confirmToken,
    });
    return { first, applied };
  }

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
    mock = app.get<MockBusinessApi>(BUSINESS_API);
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
    session = {
      "x-client": "mobile",
      authorization: `Bearer ${signIn.body.accessToken as string}`,
    };
    const meta = await call(app, "POST", "/api/v1/meta/connection", {
      headers: session,
      body: { token: `EAA${"y".repeat(40)}` },
    });
    expect(meta.statusCode).toBe(200);
    const start = await call(app, "POST", "/api/v1/business/oauth/start", {
      headers: session,
      body: { origin: APP_URL },
    });
    const url = new URL(start.body.url as string);
    await call(app, "GET", `${url.pathname}${url.search}`);
    token = await connectClient(true);
    readOnlyToken = await connectClient(false);
  });

  afterAll(async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.phone, E164),
    });
    if (user) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    for (const id of clientIds)
      await db.delete(oauthClients).where(eq(oauthClients.clientId, id));
    await db.delete(otpChallenges).where(eq(otpChallenges.phone, E164));
    await app.close();
  });

  it("offers every Google Business tool, and only read tools without write access", async () => {
    const names = (
      (await rpc(token, "tools/list")).result.tools as { name: string }[]
    ).map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_business_locations",
        "list_business_reviews",
        "get_business_profile",
        "get_business_insights",
        "find_business_on_google",
        "save_business_review_drafts",
        "send_business_review_reply",
        "create_business_post",
        "update_business_info",
        "update_business_reply_settings",
        "sync_business",
        "create_business_profile",
        "start_business_verification",
        "complete_business_verification",
      ]),
    );
    const readOnly = (
      (await rpc(readOnlyToken, "tools/list")).result.tools as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(readOnly).toContain("find_business_on_google");
    expect(readOnly).toContain("list_business_reviews");
    for (const name of [
      "create_business_profile",
      "start_business_verification",
      "complete_business_verification",
      "send_business_review_reply",
    ])
      expect(readOnly).not.toContain(name);
  });

  it("lists locations and reviews, and saves reply drafts for approval", async () => {
    const locations = await tool("list_business_locations");
    expect(locations.data.data).toHaveLength(2);
    main = locations.data.data.find(
      (l: Json) => l.title === "Sharma Dental Clinic",
    );
    expect(main).toMatchObject({
      verified: true,
      verificationState: "verified",
    });
    expect(locations.data.url).toBe(`${APP_URL}/business`);

    const pending = await tool("list_business_reviews", {
      location_id: main.id,
      stars: [1, 2],
    });
    expect(pending.data.reviews.length).toBeGreaterThan(0);
    for (const r of pending.data.reviews as Json[]) {
      expect([1, 2]).toContain(r.stars);
      expect(r.location_id).toBe(main.id);
    }
    const target = pending.data.reviews[0] as Json;

    const saved = await tool("save_business_review_drafts", {
      drafts: [
        {
          review_id: target.review_id,
          text: "We're sorry about the wait. Please call us so we can make it right.",
        },
      ],
    });
    expect(saved.data.saved).toEqual([
      { review_id: target.review_id, state: "waiting" },
    ]);
    const again = await tool("list_business_reviews", {
      location_id: main.id,
      stars: [1, 2],
    });
    expect(
      (again.data.reviews as Json[]).find(
        (r) => r.review_id === target.review_id,
      )?.draft,
    ).toMatchObject({ text: expect.stringContaining("sorry about the wait") });
    expect(mock.replies).toHaveLength(0);
  });

  it("posts a reply only after the owner allows agents and confirms", async () => {
    const review = (
      await tool("list_business_reviews", { location_id: main.id, stars: [2] })
    ).data.reviews[0] as Json;
    const args = {
      review_id: review.review_id,
      text: "Thank you for the honest feedback. We have spoken with our front desk team.",
    };
    const blocked = await tool("send_business_review_reply", args);
    expect(blocked.data.status).toBe("posting_disabled");

    await call(app, "PUT", "/api/v1/play/workspace", {
      headers: session,
      body: { agentsCanPost: true },
    });
    const first = await tool("send_business_review_reply", args);
    expect(first.data.status).toBe("confirmation_required");
    expect(first.data.summary[0]).toContain(
      `${review.author as string}'s 2-star review`,
    );
    const wrong = await tool("send_business_review_reply", {
      ...args,
      text: "Something else",
      confirm_token: first.data.confirmToken,
    });
    expect(wrong.data.status).toBe("invalid_confirmation");
    const retry = await tool("send_business_review_reply", args);
    const sent = await tool("send_business_review_reply", {
      ...args,
      confirm_token: retry.data.confirmToken,
    });
    expect(sent.data.status).toBe("applied");
    expect(mock.replies.at(-1)).toMatchObject({ text: args.text });
  });

  it("creates posts as drafts directly and publishes only after confirmation", async () => {
    const draft = await tool("create_business_post", {
      location_id: main.id,
      text: "Free dental check-up camp this Sunday.",
      when: "draft",
    });
    expect(draft.data).toMatchObject({
      status: "saved",
      post: { status: "draft" },
    });

    const { first, applied } = await twoStep("create_business_post", {
      location_id: main.id,
      text: "Now open on Sundays from 10 AM.",
      button: "CALL",
    });
    expect(first.data.summary[0]).toContain(
      "Publish now on Sharma Dental Clinic",
    );
    expect(applied.data).toMatchObject({
      status: "applied",
      result: { status: "published" },
    });
    expect(mock.createdPosts.at(-1)?.post.summary).toBe(
      "Now open on Sundays from 10 AM.",
    );
  });

  it("blocks each Google Business capability the owner turns off for AI", async () => {
    const off = await call(app, "PUT", "/api/v1/automation/settings", {
      headers: session,
      body: { agentPermissions: { gbpPosts: false, gbpDrafts: false } },
    });
    expect(off.statusCode).toBe(200);
    expect(off.body.agentPermissions).toEqual({
      gbpDrafts: false,
      gbpPosts: false,
      gbpInfo: true,
      gbpReplySettings: true,
      gbpProfiles: true,
    });

    const post = await tool("create_business_post", {
      location_id: main.id,
      text: "Blocked post",
      when: "draft",
    });
    expect(post.data).toMatchObject({
      status: "not_allowed",
      message: expect.stringContaining("Create and schedule posts"),
    });
    const review = (
      await tool("list_business_reviews", { location_id: main.id })
    ).data.reviews[0] as Json;
    const drafts = await tool("save_business_review_drafts", {
      drafts: [{ review_id: review.review_id, text: "Thanks!" }],
    });
    expect(drafts.data.status).toBe("not_allowed");

    await call(app, "PUT", "/api/v1/automation/settings", {
      headers: session,
      body: { agentPermissions: { gbpReplySettings: false } },
    });
    const one = await call(app, "PUT", "/api/v1/automation/settings", {
      headers: session,
      body: { agentPermissions: { gbpProfiles: false } },
    });
    expect(one.body.agentPermissions).toMatchObject({
      gbpReplySettings: false,
      gbpProfiles: false,
      gbpPosts: false,
      gbpDrafts: false,
    });
    await call(app, "PUT", "/api/v1/automation/settings", {
      headers: session,
      body: {
        agentPermissions: { gbpReplySettings: true, gbpProfiles: true },
      },
    });

    const bad = await call(app, "PUT", "/api/v1/automation/settings", {
      headers: session,
      body: { agentPermissions: { gbpEverything: true } },
    });
    expect(bad.statusCode).toBe(400);

    const on = await call(app, "PUT", "/api/v1/automation/settings", {
      headers: session,
      body: { agentPermissions: { gbpPosts: true, gbpDrafts: true } },
    });
    expect(Object.values(on.body.agentPermissions as Json)).toEqual(
      Array(5).fill(true),
    );
    const allowed = await tool("create_business_post", {
      location_id: main.id,
      text: "Allowed draft",
      when: "draft",
    });
    expect(allowed.data.status).toBe("saved");
  });

  it("finds a business on Google before creating one", async () => {
    const found = await tool("find_business_on_google", { name: "Gupta" });
    expect(found.data.matches).toHaveLength(2);
    expect(found.data.matches[0]).toMatchObject({
      claim_url: expect.stringContaining("business.google.com/arc/p/"),
      managed_in_treevook: null,
    });
    const ours = await tool("find_business_on_google", {
      name: "Sharma Dental",
    });
    expect(ours.data.matches[0].managed_in_treevook).toBe(main.id);
    const none = await tool("find_business_on_google", {
      name: "Nonexistent Bakery Xyz",
    });
    expect(none.data.matches).toEqual([]);
    expect(none.data.create_url).toBe(`${APP_URL}/business/create`);
  });

  it("creates, then verifies a new profile in confirmed steps", async () => {
    const base = {
      name: "Kumar Physio Care",
      category: "physiotherapist",
      phone: "+91 98350 11223",
      website: "https://kumarphysio.example.in",
      description: "Sports and back-pain physiotherapy in Patna.",
      address: {
        street: "7 Boring Canal Road",
        city: "Patna",
        state: "Bihar",
        postal_code: "800001",
      },
      hours: [{ day: "MONDAY", open: "09:00", close: "18:00" }],
    };
    const bad = await tool("create_business_profile", {
      ...base,
      category: "zzzz",
    });
    expect(bad.data.status).toBe("invalid");
    const invalid = await tool("create_business_profile", {
      ...base,
      address: { ...base.address, postal_code: "12" },
    });
    expect(invalid.data).toMatchObject({
      status: "invalid",
      problems: ["The postal code doesn't look right."],
    });

    const { first, applied } = await twoStep("create_business_profile", base);
    expect(first.data.summary).toEqual(
      expect.arrayContaining([
        "Name: Kumar Physio Care",
        "Category: Physiotherapist",
        "Address: 7 Boring Canal Road, Patna, Bihar, 800001",
      ]),
    );
    expect(applied.data.status).toBe("applied");
    const created = applied.data.result as Json;
    expect(created).toMatchObject({
      title: "Kumar Physio Care",
      verification_state: "unverified",
      url: expect.stringContaining(`${APP_URL}/business/`),
    });
    expect(mock.created).toHaveLength(1);

    const choose = await tool("start_business_verification", {
      location_id: created.location_id,
    });
    expect(choose.data.status).toBe("choose_method");
    expect(choose.data.options.map((o: Json) => o.method)).toEqual([
      "SMS",
      "PHONE_CALL",
      "EMAIL",
      "ADDRESS",
    ]);

    const early = await tool("complete_business_verification", {
      location_id: created.location_id,
      code: MOCK_VERIFICATION_PIN,
    });
    expect(early.data.status).toBe("no_pending_code");

    const started = await twoStep("start_business_verification", {
      location_id: created.location_id,
      method: "PHONE_CALL",
    });
    expect(started.first.data.summary[0]).toContain("by phone call");
    expect(started.applied.data).toMatchObject({
      status: "applied",
      result: { state: "pending", method: "PHONE_CALL", needs_code: true },
    });

    const wrong = await twoStep("complete_business_verification", {
      location_id: created.location_id,
      code: "999999",
    });
    expect(wrong.applied.isError).toBe(true);
    expect(wrong.applied.text).toContain("That code didn't work");

    const done = await twoStep("complete_business_verification", {
      location_id: created.location_id,
      code: MOCK_VERIFICATION_PIN,
    });
    expect(done.applied.data).toMatchObject({
      status: "applied",
      result: { verified: true, state: "verified" },
    });
    const after = await tool("start_business_verification", {
      location_id: created.location_id,
    });
    expect(after.data.status).toBe("already_verified");

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=50", {
      headers: session,
    });
    const events = audit.body.data as { action: string; data: Json }[];
    expect(
      events.some(
        (e) =>
          e.action === "business.location_created" &&
          e.data.via === "mcp:Claude",
      ),
    ).toBe(true);
    expect(events.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        "business.verification_started",
        "business.verified",
      ]),
    );
  });
});
