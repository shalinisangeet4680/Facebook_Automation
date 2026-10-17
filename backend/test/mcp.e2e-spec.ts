import { Resvg } from "@resvg/resvg-js";
import { createHash, randomBytes } from "crypto";

import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, sql } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockAds } from "@modules/meta/infrastructure/mock-meta.ads";
import {
  oauthClients,
  oauthRefreshTokens,
} from "@modules/oauth/infrastructure/oauth.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call, multipartFields } from "./helpers";

const PHONE = "9000000003";
const E164 = `+91${PHONE}`;
const APP_URL = "http://localhost:3200";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const CIMD_URL = "https://203.0.113.10/oauth/client-metadata.json";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("Claude connector (OAuth + MCP)", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let session: Record<string, string>;
  let clientId: string;
  let accessToken: string;
  let refreshToken: string;
  let rpcId = 0;
  const clientIds: string[] = [];

  async function form(url: string, body: Record<string, string>) {
    const res = await app.inject({
      method: "POST",
      url,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams(body).toString(),
    });
    return {
      statusCode: res.statusCode,
      body: JSON.parse(res.body || "{}") as Record<string, unknown>,
    };
  }

  function authorizeParams(
    id: string,
    challenge: string,
    extra: Record<string, string> = {},
  ) {
    return new URLSearchParams({
      response_type: "code",
      client_id: id,
      redirect_uri: CALLBACK,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "st-123",
      scope: "ads:read ads:write offline_access",
      resource: `${APP_URL}/mcp`,
      ...extra,
    });
  }

  async function authorize(id: string, allowWrite: boolean) {
    const { verifier, challenge } = pkce();
    const params = Object.fromEntries(authorizeParams(id, challenge));
    const res = await call(app, "POST", "/api/v1/oauth/authorization", {
      headers: session,
      body: { ...params, approve: true, allowWrite },
    });
    expect(res.statusCode).toBe(200);
    const redirect = new URL(res.body.redirectTo as string);
    return { code: redirect.searchParams.get("code")!, verifier, redirect };
  }

  async function exchange(id: string, code: string, verifier: string) {
    return form("/oauth/token", {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: CALLBACK,
      client_id: id,
    });
  }

  async function rpc(
    token: string,
    method: string,
    params: Record<string, unknown> = {},
  ) {
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      payload: { jsonrpc: "2.0", id: ++rpcId, method, params },
    });
    return {
      statusCode: res.statusCode,
      headers: res.headers,
      body: res.body ? (JSON.parse(res.body) as Record<string, any>) : {},
    };
  }

  async function tool(
    token: string,
    name: string,
    args: Record<string, unknown> = {},
  ) {
    const res = await rpc(token, "tools/call", { name, arguments: args });
    expect(res.statusCode).toBe(200);
    const result = res.body.result as {
      isError?: boolean;
      content: { text: string }[];
    };
    const text = result.content[0]!.text;
    let data: Record<string, any> = {};
    try {
      data = JSON.parse(text) as Record<string, any>;
    } catch {
      data = {};
    }
    return { isError: result.isError ?? false, text, data };
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
    const connected = await call(app, "POST", "/api/v1/meta/connection", {
      headers: session,
      body: { token: `EAA${"x".repeat(40)}` },
    });
    expect(connected.statusCode).toBe(200);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
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

  it("serves protected resource and authorization server metadata", async () => {
    const resource = await call(
      app,
      "GET",
      "/.well-known/oauth-protected-resource/mcp",
    );
    expect(resource.statusCode).toBe(200);
    expect(resource.body).toMatchObject({
      resource: `${APP_URL}/mcp`,
      authorization_servers: [APP_URL],
      scopes_supported: ["ads:read", "ads:write"],
    });
    const server = await call(
      app,
      "GET",
      "/.well-known/oauth-authorization-server",
    );
    expect(server.body).toMatchObject({
      issuer: APP_URL,
      authorization_endpoint: `${APP_URL}/oauth/authorize`,
      token_endpoint: `${APP_URL}/oauth/token`,
      registration_endpoint: `${APP_URL}/oauth/register`,
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
    });
    expect(server.body.token_endpoint_auth_methods_supported).toContain("none");
    expect(server.body.scopes_supported).toContain("offline_access");
  });

  it("challenges unauthenticated MCP calls with a 401 that points at the metadata", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain(
      `resource_metadata="${APP_URL}/.well-known/oauth-protected-resource/mcp"`,
    );
    const bad = await rpc("not-a-token", "tools/list");
    expect(bad.statusCode).toBe(401);
    expect(bad.headers["www-authenticate"]).toContain('error="invalid_token"');
  });

  it("registers clients dynamically and validates redirect URIs", async () => {
    const bad = await call(app, "POST", "/oauth/register", {
      body: {
        client_name: "Bad",
        redirect_uris: ["http://evil.example/cb"],
        token_endpoint_auth_method: "none",
      },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.error).toBe("invalid_redirect_uri");

    const res = await call(app, "POST", "/oauth/register", {
      body: {
        client_name: "Claude",
        redirect_uris: [CALLBACK, "http://localhost/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.client_secret).toBeUndefined();
    clientId = res.body.client_id as string;
    clientIds.push(clientId);
  });

  it("describes the request on the consent screen and refuses bad requests", async () => {
    const { challenge } = pkce();
    const ok = await call(
      app,
      "GET",
      `/api/v1/oauth/authorization?${authorizeParams(clientId, challenge)}`,
      {
        headers: session,
      },
    );
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({
      client: { name: "Claude", kind: "dcr" },
      redirectHost: "claude.ai",
      writeRequested: true,
      adAccount: { id: "act_1201000000000001" },
    });

    const wrongRedirect = await call(
      app,
      "GET",
      `/api/v1/oauth/authorization?${authorizeParams(clientId, challenge, { redirect_uri: "https://evil.example/cb" })}`,
      { headers: session },
    );
    expect(wrongRedirect.statusCode).toBe(400);
    expect((wrongRedirect.body.details as unknown) ?? null).toBeNull();

    const noPkce = await call(
      app,
      "GET",
      `/api/v1/oauth/authorization?${authorizeParams(clientId, "short", { code_challenge_method: "plain" })}`,
      { headers: session },
    );
    expect(noPkce.statusCode).toBe(400);
    expect(
      (noPkce.body.details as { redirectTo: string }).redirectTo,
    ).toContain("error=invalid_request");

    const signedOut = await call(
      app,
      "GET",
      `/api/v1/oauth/authorization?${authorizeParams(clientId, challenge)}`,
    );
    expect(signedOut.statusCode).toBe(401);
  });

  it("returns access_denied when the user cancels", async () => {
    const { challenge } = pkce();
    const res = await call(app, "POST", "/api/v1/oauth/authorization", {
      headers: session,
      body: {
        ...Object.fromEntries(authorizeParams(clientId, challenge)),
        approve: false,
      },
    });
    const redirect = new URL(res.body.redirectTo as string);
    expect(redirect.origin + redirect.pathname).toBe(CALLBACK);
    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("state")).toBe("st-123");
  });

  it("exchanges a single-use code only with the right PKCE verifier", async () => {
    const first = await authorize(clientId, true);
    expect(first.redirect.searchParams.get("state")).toBe("st-123");
    expect(first.redirect.searchParams.get("iss")).toBe(APP_URL);
    const wrong = await exchange(clientId, first.code, pkce().verifier);
    expect(wrong.statusCode).toBe(400);
    expect(wrong.body.error).toBe("invalid_grant");
    const replay = await exchange(clientId, first.code, first.verifier);
    expect(replay.body.error).toBe("invalid_grant");

    const second = await authorize(clientId, true);
    const res = await exchange(clientId, second.code, second.verifier);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
      scope: "ads:read ads:write",
    });
    accessToken = res.body.access_token as string;
    refreshToken = res.body.refresh_token as string;
  });

  it("lists every tool for a grant with changes allowed", async () => {
    const init = await rpc(accessToken, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.statusCode).toBe(200);
    expect(init.body.result.serverInfo.name).toBe("treevook");
    expect(init.body.result.instructions).toContain("confirm_token");

    const list = await rpc(accessToken, "tools/list");
    const names = (list.body.result.tools as { name: string }[])
      .map((t) => t.name)
      .sort();
    expect(names).toEqual([
      "activate",
      "apply_facebook_profile",
      "check_tracking",
      "create_business_post",
      "create_campaign_draft",
      "delete_review_template",
      "draft_release_notes",
      "draft_review_reply",
      "explain_crash",
      "get_account_overview",
      "get_app_health",
      "get_business_insights",
      "get_business_profile",
      "get_campaign",
      "get_performance",
      "get_planning_context",
      "get_profile_checkup",
      "get_review_analytics",
      "get_review_insights",
      "get_review_settings",
      "get_review_templates",
      "get_suggestions",
      "import_review_history",
      "list_business_locations",
      "list_business_reviews",
      "list_campaign_plans",
      "list_campaigns",
      "list_creatives",
      "list_play_apps",
      "list_play_releases",
      "list_play_reviews",
      "list_social_posts",
      "pause",
      "propose_campaign_plan",
      "publish_post",
      "save_ad_creative",
      "save_business_review_drafts",
      "save_profile_draft",
      "save_review_drafts",
      "search_targeting",
      "send_business_review_reply",
      "send_review_reply",
      "set_review_rules",
      "set_template_hidden",
      "store_get_project",
      "store_save_project",
      "store_start_upload",
      "sync_business",
      "sync_play_apps",
      "update_business_info",
      "update_business_reply_settings",
      "update_campaign_plan",
      "update_daily_budget",
      "update_review_settings",
      "update_review_workspace",
      "update_rollout",
      "upsert_review_template",
    ]);
  });

  it("answers read tools from the selected ad account", async () => {
    const overview = await tool(accessToken, "get_account_overview");
    expect(overview.data.adAccount).toMatchObject({
      id: "act_1201000000000001",
      currency: "INR",
    });
    expect(overview.data.pixel.id).toBe("2519233968487265");

    const perf = await tool(accessToken, "get_performance", {
      level: "campaign",
      date_preset: "last_7d",
    });
    expect(perf.isError).toBe(false);
    expect(perf.data.currency).toBe("INR");
    const leads = (
      perf.data.rows as {
        name: string;
        result: { type: string } | null;
        spend: number;
      }[]
    )[0]!;
    expect(leads.spend).toBeGreaterThan(0);
    expect(leads.result?.type).toBe("lead");

    const daily = await tool(accessToken, "get_performance", {
      level: "account",
      date_preset: "last_7d",
      daily: true,
    });
    expect(daily.data.rows).toHaveLength(7);

    const campaigns = await tool(accessToken, "list_campaigns", {
      status: "active",
    });
    expect(campaigns.data.campaigns).toHaveLength(1);

    const detail = await tool(accessToken, "get_campaign", {
      campaign_id: "120210000000000001",
    });
    expect(detail.data.adSets[0].dailyBudget).toBe(800);
    expect(detail.data.ads).toHaveLength(2);

    const tracking = await tool(accessToken, "check_tracking");
    expect(tracking.data.warnings).toEqual([]);

    const cities = await tool(accessToken, "search_targeting", {
      type: "city",
      query: "pat",
    });
    expect(cities.data.results[0].key).toBe("1035921");

    const invalid = await tool(accessToken, "get_campaign", {
      campaign_id: "abc",
    });
    expect(invalid.isError).toBe(true);
  });

  it("creates paused drafts and never activates without the user's confirmation", async () => {
    const draftArgs = {
      name: "Clinic owners – Patna – Demo",
      goal: "leads",
      daily_budget: 600,
      targeting: {
        cities: [{ key: "1035921", radius_km: 25 }],
        age_min: 26,
        age_max: 60,
      },
      creative: {
        primary_text: "Run your whole clinic from one app. Try the free demo.",
        headline: "Free demo clinic",
        link_url: "https://arogyasystem.com/",
        image_url: "https://arogyasystem.com/og.png",
        call_to_action: "SIGN_UP",
      },
    };
    const draft = await tool(accessToken, "create_campaign_draft", draftArgs);
    expect(draft.isError).toBe(false);
    expect(draft.data.status).toBe("created_paused");
    const campaignId = draft.data.campaignId as string;

    const again = await tool(accessToken, "create_campaign_draft", draftArgs);
    expect(again.data.campaignId).toBe(campaignId);
    expect(again.data.duplicate).toBe(true);

    const detail = await tool(accessToken, "get_campaign", {
      campaign_id: campaignId,
    });
    expect(detail.data.campaign.status).toBe("PAUSED");
    expect(detail.data.adSets[0].status).toBe("PAUSED");
    expect(detail.data.adSets[0].promotedObject).toEqual({
      pixel_id: "2519233968487265",
      custom_event_type: "LEAD",
    });
    expect(detail.data.adSets[0].targeting.geo_locations).toEqual({
      cities: [{ key: "1035921", radius: 25, distance_unit: "kilometer" }],
    });

    const tooBig = await tool(accessToken, "create_campaign_draft", {
      ...draftArgs,
      name: "Huge",
      daily_budget: 50_000,
    });
    expect(tooBig.isError).toBe(true);
    expect(tooBig.text).toContain("BUDGET_LIMIT");

    const rejectedByMeta = await tool(accessToken, "create_campaign_draft", {
      ...draftArgs,
      name: "Broken link",
      creative: { ...draftArgs.creative, link_url: "https://reject.example/" },
    });
    expect(rejectedByMeta.isError).toBe(true);
    expect(rejectedByMeta.text).toContain("isn't working");

    const ask = await tool(accessToken, "activate", { id: campaignId });
    expect(ask.data.status).toBe("confirmation_required");
    expect(ask.data.summary).toContain("Daily budget across ad sets: ₹600");
    const stillPaused = await tool(accessToken, "get_campaign", {
      campaign_id: campaignId,
    });
    expect(stillPaused.data.campaign.status).toBe("PAUSED");

    const forged = await tool(accessToken, "activate", {
      id: campaignId,
      confirm_token: "made-up",
    });
    expect(forged.isError).toBe(true);
    expect(forged.text).toContain("CONFIRMATION_REQUIRED");

    const otherTarget = await tool(accessToken, "activate", {
      id: "120210000000000002",
      confirm_token: ask.data.confirmToken,
    });
    expect(otherTarget.isError).toBe(true);

    const ask2 = await tool(accessToken, "activate", { id: campaignId });
    const done = await tool(accessToken, "activate", {
      id: campaignId,
      confirm_token: ask2.data.confirmToken,
    });
    expect(done.data.status).toBe("active");
    expect(done.data.activated).toHaveLength(3);
    const reuse = await tool(accessToken, "activate", {
      id: campaignId,
      confirm_token: ask2.data.confirmToken,
    });
    expect(reuse.data.status).toBe("already_active");

    const paused = await tool(accessToken, "pause", { id: campaignId });
    expect(paused.data.status).toBe("paused");
  });

  it("changes budgets only after confirmation and within the limit", async () => {
    const adSet = "120220000000000001";
    const over = await tool(accessToken, "update_daily_budget", {
      id: adSet,
      daily_budget: 20_000,
    });
    expect(over.text).toContain("BUDGET_LIMIT");

    const ask = await tool(accessToken, "update_daily_budget", {
      id: adSet,
      daily_budget: 1000,
    });
    expect(ask.data.summary).toContain("from ₹800 to ₹1,000 (+25%)");
    const mismatch = await tool(accessToken, "update_daily_budget", {
      id: adSet,
      daily_budget: 5000,
      confirm_token: ask.data.confirmToken,
    });
    expect(mismatch.isError).toBe(true);

    const ask2 = await tool(accessToken, "update_daily_budget", {
      id: adSet,
      daily_budget: 1000,
    });
    const done = await tool(accessToken, "update_daily_budget", {
      id: adSet,
      daily_budget: 1000,
      confirm_token: ask2.data.confirmToken,
    });
    expect(done.data).toMatchObject({ status: "updated", from: 800, to: 1000 });

    const onAd = await tool(accessToken, "update_daily_budget", {
      id: "120230000000000001",
      daily_budget: 500,
    });
    expect(onAd.text).toContain("Ads don't have budgets");
  });

  it("lets Claude propose a plan that the owner edits, creates and launches in the app", async () => {
    const context = await tool(accessToken, "get_planning_context");
    expect(context.data.options.currency).toBe("INR");
    expect(context.data.last90Days.byCampaign.length).toBeGreaterThan(0);
    expect(context.data.tracking.pixel.id).toBe("2519233968487265");

    const plan = {
      name: "Clinic owners – Bihar – Demo sign-ups",
      summary: "Bihar clinics convert best; focus on demo sign-ups.",
      goal: "leads",
      conversionEvent: "COMPLETE_REGISTRATION",
      dailyBudget: 500,
      targeting: {
        regions: [{ key: "1730", name: "Bihar" }],
        cities: [],
        ageMin: 28,
        ageMax: 55,
        genders: "all",
        interests: [{ id: "6003107902433", name: "Physician" }],
      },
      creative: {
        primaryText: "Run your clinic from one app.",
        alternatives: ["Save 2 hours a day at the front desk."],
        headline: "Free demo clinic",
        linkUrl: "https://arogyasystem.com/demo",
        imageIdea: "Doctor using the app at the front desk",
        callToAction: "SIGN_UP",
      },
      reasons: {
        goal: "Demo sign-ups fire CompleteRegistration.",
        audience: "Past leads came from Bihar.",
        budget: "About 20 sign-ups a week.",
        creative: "Time saved is the strongest angle.",
      },
      expectedResults: "15–25 sign-ups a week",
    };

    const bad = await tool(accessToken, "propose_campaign_plan", {
      ...plan,
      dailyBudget: 50_000,
    });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("BUDGET_LIMIT");

    const proposed = await tool(accessToken, "propose_campaign_plan", plan);
    expect(proposed.isError).toBe(false);
    const planId = proposed.data.planId as string;
    expect(proposed.data.reviewUrl).toBe(
      `${APP_URL}/campaigns/plans/${planId}`,
    );

    const listed = await tool(accessToken, "list_campaign_plans");
    expect(listed.data.plans[0].id).toBe(planId);

    const detail = await call(app, "GET", `/api/v1/campaign-plans/${planId}`, {
      headers: session,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.body).toMatchObject({
      status: "draft",
      source: "mcp:Claude",
      options: { currency: "INR", maxDailyBudget: 10000 },
    });

    const noImage = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/create`,
      { headers: session },
    );
    expect(noImage.statusCode).toBe(400);

    const edited = {
      ...plan,
      dailyBudget: 450,
      creative: {
        ...plan.creative,
        imageUrl: "https://arogyasystem.com/og.png",
      },
    };
    const saved = await call(app, "PUT", `/api/v1/campaign-plans/${planId}`, {
      headers: session,
      body: { plan: edited },
    });
    expect(saved.statusCode).toBe(200);
    expect((saved.body.plan as { dailyBudget: number }).dailyBudget).toBe(450);

    const invalid = await call(app, "PUT", `/api/v1/campaign-plans/${planId}`, {
      headers: session,
      body: {
        plan: {
          ...edited,
          targeting: { ...edited.targeting, ageMin: 60, ageMax: 30 },
        },
      },
    });
    expect(invalid.statusCode).toBe(400);

    const early = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/launch`,
      { headers: session, body: { confirm: true } },
    );
    expect(early.statusCode).toBe(409);

    const created = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/create`,
      { headers: session },
    );
    expect(created.statusCode).toBe(200);
    expect(created.body.status).toBe("created");
    const meta = created.body.meta as { campaignId: string };
    const again = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/create`,
      { headers: session },
    );
    expect(again.statusCode).toBe(409);

    const inMeta = await tool(accessToken, "get_campaign", {
      campaign_id: meta.campaignId,
    });
    expect(inMeta.data.campaign.status).toBe("PAUSED");
    expect(inMeta.data.adSets[0]).toMatchObject({
      dailyBudget: 450,
      status: "PAUSED",
    });
    expect(inMeta.data.adSets[0].targeting.geo_locations).toEqual({
      regions: [{ key: "1730" }],
    });
    expect(inMeta.data.adSets[0].promotedObject.custom_event_type).toBe(
      "COMPLETE_REGISTRATION",
    );

    const locked = await tool(accessToken, "update_campaign_plan", {
      plan_id: planId,
      plan,
    });
    expect(locked.isError).toBe(true);

    const unconfirmed = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/launch`,
      { headers: session, body: { confirm: false } },
    );
    expect(unconfirmed.statusCode).toBe(400);
    const launched = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/launch`,
      { headers: session, body: { confirm: true } },
    );
    expect(launched.statusCode).toBe(200);
    expect(launched.body.status).toBe("launched");
    const live = await tool(accessToken, "get_campaign", {
      campaign_id: meta.campaignId,
    });
    expect(live.data.campaign.status).toBe("ACTIVE");
    expect(live.data.ads[0].status).toBe("ACTIVE");

    const second = await tool(accessToken, "propose_campaign_plan", {
      ...plan,
      name: "Second idea",
    });
    const discarded = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${second.data.planId as string}/discard`,
      { headers: session },
    );
    expect(discarded.body.status).toBe("discarded");

    const list = await call(app, "GET", "/api/v1/campaign-plans", {
      headers: session,
    });
    expect(
      (list.body.data as { status: string }[]).map((p) => p.status),
    ).toEqual(["discarded", "launched"]);
  });

  it("targets clinics with job titles and industries AND business owners", async () => {
    const titles = await tool(accessToken, "search_targeting", {
      type: "work_position",
      query: "doc",
    });
    expect(titles.data.results[0]).toMatchObject({
      key: "107402372623035",
      type: "work_position",
    });
    const behaviors = await tool(accessToken, "search_targeting", {
      type: "behavior",
      query: "small business",
    });
    expect(behaviors.data.results[0].key).toBe("6002714898572");

    const proposed = await tool(accessToken, "propose_campaign_plan", {
      name: "Clinics – titles and owners",
      summary: "Clinic owners.",
      goal: "traffic",
      dailyBudget: 300,
      targeting: {
        regions: [{ key: "1730", name: "Bihar" }],
        ageMin: 26,
        ageMax: 60,
        workPositions: [{ id: "107402372623035", name: "Doctor" }],
        industries: [
          { id: "6012903159383", name: "Healthcare and medical services" },
        ],
        behaviors: [{ id: "6002714898572", name: "Small business owners" }],
      },
      creative: {
        primaryText: "Run your clinic from one app.",
        headline: "Free trial",
        linkUrl: "https://arogyasystem.com/register",
        imageUrl: "https://arogyasystem.com/og.png",
        callToAction: "SIGN_UP",
      },
      reasons: { goal: "g", audience: "a", budget: "b", creative: "c" },
    });
    const created = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${proposed.data.planId as string}/create`,
      { headers: session },
    );
    expect(created.statusCode).toBe(200);
    const detail = await tool(accessToken, "get_campaign", {
      campaign_id: (created.body.meta as { campaignId: string }).campaignId,
    });
    expect(detail.data.adSets[0].targeting.flexible_spec).toEqual([
      {
        work_positions: [{ id: "107402372623035", name: "Doctor" }],
        industries: [
          { id: "6012903159383", name: "Healthcare and medical services" },
        ],
      },
      { behaviors: [{ id: "6002714898572", name: "Small business owners" }] },
    ]);
  });

  it("creates a plan's ad from an existing Instagram post without an image", async () => {
    const plan = {
      name: "Boost best Instagram post",
      summary: "Boost the post that already has engagement.",
      goal: "traffic",
      dailyBudget: 300,
      targeting: { countries: ["IN"], ageMin: 25, ageMax: 60 },
      creative: {
        primaryText: "From the post",
        headline: "Try the demo",
        linkUrl: "https://arogyasystem.com/",
        callToAction: "LEARN_MORE",
        post: {
          platform: "instagram",
          id: "17900000000000001",
          imageUrl: "https://arogyasystem.com/og.png",
        },
      },
      reasons: { goal: "g", audience: "a", budget: "b", creative: "c" },
    };
    const proposed = await tool(accessToken, "propose_campaign_plan", plan);
    expect(proposed.isError).toBe(false);
    const created = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${proposed.data.planId as string}/create`,
      { headers: session },
    );
    expect(created.statusCode).toBe(200);
    const meta = created.body.meta as { campaignId: string };
    const detail = await tool(accessToken, "get_campaign", {
      campaign_id: meta.campaignId,
    });
    expect(detail.data.ads[0].creative.body).toContain(
      "Existing instagram post 17900000000000001",
    );
  });

  it("renders Claude's SVG design into a creative served publicly", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#0C4A41"/><text x="80" y="540" font-size="96" fill="#fff" font-family="Helvetica">Run your clinic</text></svg>`;
    const saved = await tool(accessToken, "save_ad_creative", {
      name: "Clinic banner",
      svg,
      format: "square",
    });
    expect(saved.isError).toBe(false);
    expect(saved.data).toMatchObject({
      name: "Clinic banner",
      source: "claude",
      width: 1080,
      height: 1080,
      mime: "image/png",
    });
    const path = new URL(saved.data.url as string).pathname;
    const image = await app.inject({ method: "GET", url: path });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.rawPayload.subarray(1, 4).toString()).toBe("PNG");

    const wrongShape = await tool(accessToken, "save_ad_creative", {
      name: "Wide",
      svg,
      format: "story",
    });
    expect(wrongShape.isError).toBe(true);
    expect(wrongShape.text).toContain("viewBox");
    const unsafe = await tool(accessToken, "save_ad_creative", {
      name: "Bad",
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
    });
    expect(unsafe.isError).toBe(true);
    const listed = await tool(accessToken, "list_creatives");
    expect(listed.data.data[0].name).toBe("Clinic banner");
  });

  it("keeps a store listing project in step with the plugin", async () => {
    const saved = await tool(accessToken, "store_save_project", {
      name: "Clinic App",
      languages: ["en", "hi"],
    });
    expect(saved.isError).toBe(false);
    expect(saved.data.url).toBe(`${APP_URL}/store/${saved.data.projectId}`);
    expect(saved.data.uploadUrl).toBe(`${APP_URL}/api/v1/store-uploads`);
    expect(saved.data.uploadToken).toMatch(/^stu_/);

    const png = new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#1b2536"/></svg>',
    )
      .render()
      .asPng();
    const body = multipartFields(png, "image/png", "01_home.png", {
      kind: "preview",
      name: "01_home",
      style: "bold",
      lang: "en",
      size: "phone",
    });
    const uploaded = await app.inject({
      method: "POST",
      url: "/api/v1/store-uploads",
      headers: {
        "content-type": body.contentType,
        "x-upload-token": saved.data.uploadToken as string,
      },
      payload: body.payload,
    });
    expect(uploaded.statusCode).toBe(201);

    const project = await tool(accessToken, "store_get_project", {
      project_id: saved.data.projectId,
    });
    expect(project.data).toMatchObject({
      name: "Clinic App",
      status: "choosing",
      choice: null,
      counts: { previews: 1 },
    });
    expect(project.data.next).toContain("Waiting for the user");

    const again = await tool(accessToken, "store_save_project", {
      name: "Clinic App",
      languages: ["en"],
    });
    expect(again.data.projectId).toBe(saved.data.projectId);
    const fresh = await tool(accessToken, "store_start_upload", {
      project_id: saved.data.projectId,
    });
    expect(fresh.data.uploadToken).not.toBe(again.data.uploadToken);

    const all = await tool(accessToken, "store_get_project");
    expect(all.data.data).toHaveLength(1);
  });

  it("accepts a workspace access token, rotates it with a grace period and revokes it", async () => {
    const revealed = await call(
      app,
      "POST",
      "/api/v1/play/workspace/token/reveal",
      {
        headers: session,
      },
    );
    const token = revealed.body.token as string;
    expect(token).toMatch(/^rk_live_[0-9a-f]{36}$/);
    const settings = await call(app, "GET", "/api/v1/play/workspace", {
      headers: session,
    });
    expect(settings.body.token).toBe(
      `${token.slice(0, 8)}••••••••••${token.slice(-3)}`,
    );
    expect((await rpc(token, "tools/list")).statusCode).toBe(200);
    await tool(token, "list_play_apps");
    const clients = await call(app, "GET", "/api/v1/play/workspace/clients", {
      headers: session,
    });
    expect((clients.body.data as unknown[])[0]).toMatchObject({
      id: "token",
      kind: "token",
      lastTool: "list_play_apps",
    });

    const rotated = await call(
      app,
      "POST",
      "/api/v1/play/workspace/token/rotate",
      {
        headers: session,
      },
    );
    expect(rotated.body.token).not.toBe(token);
    expect((await rpc(token, "tools/list")).statusCode).toBe(200);
    expect(
      (await rpc(rotated.body.token as string, "tools/list")).statusCode,
    ).toBe(200);

    const revoked = await call(
      app,
      "DELETE",
      "/api/v1/play/workspace/clients/token",
      { headers: session },
    );
    expect(revoked.statusCode).toBe(204);
    expect(
      (await rpc(rotated.body.token as string, "tools/list")).statusCode,
    ).toBe(401);
    expect((await rpc("rk_live_nope", "tools/list")).statusCode).toBe(401);
  });

  it("lets Claude draft and send Google Play review replies", async () => {
    const key = JSON.stringify({
      type: "service_account",
      project_id: "acme-play",
      private_key:
        "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n",
      client_email: "claude-test@acme-play.iam.gserviceaccount.com",
    });
    const connection = await call(app, "POST", "/api/v1/play/connections", {
      headers: session,
      body: { key },
    });
    const added = await call(app, "POST", "/api/v1/play/apps", {
      headers: session,
      body: {
        connectionId: connection.body.id,
        packageName: "com.claude.reviews",
      },
    });
    const appId = added.body.id as string;

    const apps = await tool(accessToken, "list_play_apps");
    expect(apps.data.data[0]).toMatchObject({ id: appId, waiting: 8 });

    const list = await tool(accessToken, "list_play_reviews", {
      app_id: appId,
      stars: [1],
      limit: 5,
    });
    expect(list.data.total).toBe(2);
    const crash = (list.data.reviews as Record<string, any>[]).find((r) =>
      r.text.includes("crashing"),
    )!;
    expect(crash).toMatchObject({
      author: "Rahul Verma",
      can_reply: true,
      draft: { status: "pending_approval" },
    });

    const templates = await tool(accessToken, "get_review_templates", {
      app_id: appId,
    });
    expect(templates.data.reply_max).toBe(350);
    expect(
      (templates.data.templates as unknown[]).length,
    ).toBeGreaterThanOrEqual(7);

    const insights = await tool(accessToken, "get_review_insights", {
      app_id: appId,
      days: 30,
    });
    expect(insights.data).toMatchObject({
      reviews: 8,
      distribution: [2, 1, 1, 1, 3],
    });

    const drafted = await tool(accessToken, "save_review_drafts", {
      app_id: appId,
      drafts: [
        {
          review_id: crash.review_id,
          text: "Sorry Rahul, we found the orders crash and fixed it in 2.3.2.",
        },
      ],
    });
    expect(drafted.data).toEqual({
      saved: [{ review_id: crash.review_id, state: "waiting" }],
      url: `${APP_URL}/reviews/${appId}`,
    });

    const blocked = await tool(accessToken, "send_review_reply", {
      app_id: appId,
      review_id: crash.review_id,
      text: "Sorry Rahul, fixed in 2.3.2. Please update!",
    });
    expect(blocked.data.status).toBe("posting_disabled");
    await call(app, "PUT", "/api/v1/play/workspace", {
      headers: session,
      body: { agentsCanPost: true },
    });

    const args = {
      app_id: appId,
      review_id: crash.review_id,
      text: "Sorry Rahul, fixed in 2.3.2. Please update!",
    };
    const first = await tool(accessToken, "send_review_reply", args);
    expect(first.data.status).toBe("confirmation_required");
    expect(first.data.summary).toContain("Rahul Verma's 1-star review");
    const wrong = await tool(accessToken, "send_review_reply", {
      ...args,
      text: "different",
      confirm_token: first.data.confirmToken,
    });
    expect(wrong.data.status).toBe("invalid_confirmation");
    const second = await tool(accessToken, "send_review_reply", args);
    const sent = await tool(accessToken, "send_review_reply", {
      ...args,
      confirm_token: second.data.confirmToken,
    });
    expect(sent.data).toMatchObject({
      status: "sent",
      reply: { text: args.text },
    });

    await call(app, "DELETE", `/api/v1/play/apps/${appId}`, {
      headers: session,
    });
    await call(
      app,
      "DELETE",
      `/api/v1/play/connections/${connection.body.id as string}`,
      { headers: session },
    );
  });

  it("lets Claude read and change review settings with confirmation", async () => {
    const connection = await call(app, "POST", "/api/v1/play/connections", {
      headers: session,
      body: {
        key: JSON.stringify({
          type: "service_account",
          project_id: "acme-play",
          private_key:
            "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n",
          client_email: "settings-test@acme-play.iam.gserviceaccount.com",
        }),
      },
    });
    const added = await call(app, "POST", "/api/v1/play/apps", {
      headers: session,
      body: {
        connectionId: connection.body.id,
        packageName: "com.claude.settings",
      },
    });
    const appId = added.body.id as string;
    const settings = await tool(accessToken, "get_review_settings", {
      app_id: appId,
    });
    expect(settings.data.rating_rules).toHaveLength(5);
    expect(settings.data.options.delays).toContain("6h");

    const args = {
      app_id: appId,
      delay: "6h",
      tone: "concise",
      placeholders: { support_email: "care@claude.app" },
      rating_rules: [{ rating: 3, mode: "manual" }],
    };
    const first = await tool(accessToken, "update_review_settings", args);
    expect(first.data.status).toBe("confirmation_required");
    expect(first.data.summary).toEqual(
      expect.arrayContaining([
        "3★ mode: approval → manual",
        "Posting delay: 15 min → 6 hours",
        "Voice: friendly → concise",
        "{support_email}: help@claudesettings.example → care@claude.app",
      ]),
    );
    const applied = await tool(accessToken, "update_review_settings", {
      ...args,
      confirm_token: first.data.confirmToken,
    });
    expect(applied.data.status).toBe("applied");
    expect(applied.data.result.behavior).toMatchObject({
      delay: "6h",
      tone: "concise",
    });
    expect(applied.data.result.placeholders.support_email).toBe(
      "care@claude.app",
    );
    expect(
      (await tool(accessToken, "update_review_settings", args)).data.status,
    ).toBe("no_changes");

    await call(app, "PUT", "/api/v1/play/workspace", {
      headers: session,
      body: { agentsCanPost: false },
    });
    const auto = await tool(accessToken, "update_review_settings", {
      app_id: appId,
      rating_rules: [{ rating: 5, mode: "auto" }],
    });
    expect(auto.data.status).toBe("auto_needs_permission");

    const rules = await tool(accessToken, "set_review_rules", {
      app_id: appId,
      rules: [
        {
          name: "Refunds go to Claude",
          conditions: { keywords_any: ["refund"] },
          action: "claude",
        },
      ],
    });
    expect(rules.data.status).toBe("confirmation_required");
    const saved = await tool(accessToken, "set_review_rules", {
      app_id: appId,
      rules: [
        {
          name: "Refunds go to Claude",
          conditions: { keywords_any: ["refund"] },
          action: "claude",
        },
      ],
      confirm_token: rules.data.confirmToken,
    });
    expect(saved.data.result.advanced_rules).toEqual([
      expect.objectContaining({
        name: "Refunds go to Claude",
        action: { type: "claude" },
      }),
    ]);

    const made = await tool(accessToken, "upsert_review_template", {
      name: "Thanks in two languages",
      ratings: [5, 4],
      app_id: appId,
      bodies: [
        {
          language: "en",
          variants: [
            "Thanks {user_name}! — {developer_name}",
            "Thank you, {user_name}!",
          ],
        },
        { language: "hi", variants: ["धन्यवाद {user_name}!"] },
      ],
    });
    expect(made.data).toMatchObject({
      name: "Thanks in two languages",
      ratings: [5, 4],
      app_id: appId,
      problems: [],
    });
    expect(made.data.samples).toHaveLength(3);
    expect(made.data.url).toBe(`${APP_URL}/reviews/templates`);
    const edited = await tool(accessToken, "upsert_review_template", {
      template_id: made.data.id,
      name: "Thanks in two languages",
      body: "Thanks {user_name}, write to {hotline} anytime.",
    });
    expect(edited.data.problems[0].problem).toContain("{hotline}");
    const missing = await tool(accessToken, "upsert_review_template", {
      name: "Empty",
    });
    expect(missing.isError).toBe(true);

    const current = await tool(accessToken, "get_review_settings", {
      app_id: appId,
    });
    const builtIns = current.data.templates as {
      id: string;
      name: string;
      built_in: boolean;
    }[];
    const used = new Set(
      (current.data.rating_rules as { template_id: string | null }[]).map(
        (r) => r.template_id,
      ),
    );
    const spare = builtIns.find(
      (t) => t.built_in && !used.has(t.id) && t.name === "Feature request",
    )!;
    const hidden = await tool(accessToken, "set_template_hidden", {
      template_id: spare.id,
      hidden: true,
    });
    expect(hidden.data).toMatchObject({ id: spare.id, hidden: true });
    const inUse = await tool(accessToken, "set_template_hidden", {
      template_id: [...used].find(Boolean)!,
      hidden: true,
    });
    expect(inUse.isError).toBe(true);
    const own = await tool(accessToken, "set_template_hidden", {
      template_id: made.data.id,
      hidden: true,
    });
    expect(own.isError).toBe(true);
    const shown = await tool(accessToken, "set_template_hidden", {
      template_id: spare.id,
      hidden: false,
    });
    expect(shown.data.hidden).toBe(false);

    await call(
      app,
      "DELETE",
      `/api/v1/play/connections/${connection.body.id as string}`,
      { headers: session },
    );
  });
  it("refuses objects outside the selected ad account", async () => {
    const res = await tool(accessToken, "pause", { id: "999999999" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("isn't in your selected ad account");
  });

  it("records changes made through Claude in the audit log", async () => {
    const res = await call(app, "GET", "/api/v1/audit-events?limit=50", {
      headers: session,
    });
    const events = res.body.data as {
      action: string;
      data: { via?: string };
    }[];
    const actions = events.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "oauth.app_connected",
        "ads.draft_created",
        "ads.activated",
        "ads.paused",
        "ads.budget_changed",
      ]),
    );
    expect(
      events.some(
        (e) => e.action === "ads.draft_created" && e.data.via === "mcp:Claude",
      ),
    ).toBe(true);
  });

  it("gives read-only tools when the user doesn't allow changes", async () => {
    const reg = await call(app, "POST", "/oauth/register", {
      body: {
        client_name: "Read only",
        redirect_uris: [CALLBACK],
        token_endpoint_auth_method: "none",
      },
    });
    const id = reg.body.client_id as string;
    clientIds.push(id);
    const { code, verifier } = await authorize(id, false);
    const tokens = await exchange(id, code, verifier);
    expect(tokens.body.scope).toBe("ads:read");
    const list = await rpc(tokens.body.access_token as string, "tools/list");
    const names = (list.body.result.tools as { name: string }[]).map(
      (t) => t.name,
    );
    expect(names).toHaveLength(27);
    expect(names).toContain("list_business_reviews");
    expect(names).not.toContain("send_business_review_reply");
    expect(names).toContain("list_play_reviews");
    expect(names).not.toContain("send_review_reply");
    expect(names).toContain("get_app_health");
    expect(names).not.toContain("update_rollout");
    expect(names).toContain("store_get_project");
    expect(names).not.toContain("activate");
    expect(names).not.toContain("store_save_project");
  });

  it("supports confidential clients with a secret", async () => {
    const reg = await call(app, "POST", "/oauth/register", {
      body: {
        client_name: "Confidential",
        redirect_uris: [CALLBACK],
        token_endpoint_auth_method: "client_secret_basic",
      },
    });
    const id = reg.body.client_id as string;
    const secret = reg.body.client_secret as string;
    clientIds.push(id);
    expect(secret).toBeTruthy();
    const { code, verifier } = await authorize(id, false);
    const noSecret = await exchange(id, code, verifier);
    expect(noSecret.statusCode).toBe(401);
    expect(noSecret.body.error).toBe("invalid_client");

    const again = await authorize(id, false);
    const res = await app.inject({
      method: "POST",
      url: "/oauth/token",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      },
      payload: new URLSearchParams({
        grant_type: "authorization_code",
        code: again.code,
        code_verifier: again.verifier,
        redirect_uri: CALLBACK,
      }).toString(),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts a client identified by a metadata document", async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== CIMD_URL) return realFetch(input, init);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              client_id: CIMD_URL,
              client_name: "Claude (metadata)",
              redirect_uris: [CALLBACK],
              token_endpoint_auth_method: "none",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      },
    );
    clientIds.push(CIMD_URL);
    const { code, verifier } = await authorize(CIMD_URL, true);
    const res = await exchange(CIMD_URL, code, verifier);
    expect(res.statusCode).toBe(200);
    const row = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.clientId, CIMD_URL),
    });
    expect(row?.kind).toBe("cimd");
    vi.unstubAllGlobals();
  });

  it("rotates refresh tokens and revokes the connection when an old one is replayed", async () => {
    const rotated = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.body.refresh_token).not.toBe(refreshToken);
    const newAccess = rotated.body.access_token as string;

    const raced = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });
    expect(raced.body.error).toBe("invalid_grant");
    expect((await rpc(newAccess, "tools/list")).statusCode).toBe(200);

    await db
      .update(oauthRefreshTokens)
      .set({ replacedAt: sql`now() - interval '5 minutes'` })
      .where(sql`replaced_at is not null`);
    const replay = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });
    expect(replay.body.error).toBe("invalid_grant");

    const blocked = await rpc(newAccess, "tools/list");
    expect(blocked.statusCode).toBe(401);
    const latest = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: rotated.body.refresh_token as string,
      client_id: clientId,
    });
    expect(latest.body.error).toBe("invalid_grant");
  });

  it("lists connected apps and disconnects one immediately", async () => {
    const { code, verifier } = await authorize(clientId, true);
    const tokens = await exchange(clientId, code, verifier);
    const token = tokens.body.access_token as string;
    expect((await rpc(token, "tools/list")).statusCode).toBe(200);

    const list = await call(app, "GET", "/api/v1/connected-apps", {
      headers: session,
    });
    const apps = list.body.data as {
      id: string;
      name: string;
      lastUsedAt: string | null;
    }[];
    const claude = apps.find((a) => a.name === "Claude")!;
    expect(claude.lastUsedAt).not.toBeNull();

    const info = await call(app, "GET", "/api/v1/connector", {
      headers: session,
    });
    expect(info.body.mcpUrl).toBe(`${APP_URL}/mcp`);

    const del = await call(
      app,
      "DELETE",
      `/api/v1/connected-apps/${claude.id}`,
      { headers: session },
    );
    expect(del.statusCode).toBe(204);
    expect((await rpc(token, "tools/list")).statusCode).toBe(401);
    const missing = await call(
      app,
      "DELETE",
      `/api/v1/connected-apps/${claude.id}`,
      { headers: session },
    );
    expect(missing.statusCode).toBe(404);
  });

  it("revokes tokens through the revocation endpoint", async () => {
    const { code, verifier } = await authorize(clientId, false);
    const tokens = await exchange(clientId, code, verifier);
    const revoke = await form("/oauth/revoke", {
      token: tokens.body.refresh_token as string,
      client_id: clientId,
    });
    expect(revoke.statusCode).toBe(200);
    expect(
      (await rpc(tokens.body.access_token as string, "tools/list")).statusCode,
    ).toBe(401);
  });

  it("rejects GET on the MCP endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/mcp",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect([401, 405]).toContain(res.statusCode);
  });
});
