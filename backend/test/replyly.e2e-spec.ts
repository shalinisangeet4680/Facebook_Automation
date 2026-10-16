import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { PlayEngine } from "@modules/play/application/play-engine.service";
import { ESCALATION_NOTIFIER } from "@modules/play/domain/ports/notifier";
import { REPLY_AI } from "@modules/play/domain/ports/reply-ai";
import {
  addMockReview,
  resetMockPlay,
} from "@modules/play/infrastructure/mock-play.api";
import { MockReplyAi } from "@modules/play/infrastructure/mock-reply.ai";
import { playApps } from "@modules/play/infrastructure/play.tables";
import { MockNotifier } from "@modules/play/infrastructure/slack.notifier";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000017";

type Json = Record<string, any>;

describe("Replyly inbox, AI drafts and analytics", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let appId: string;

  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{ statusCode: number; body: Json }> =>
    call(app, method, `/api/v1/play${url}`, { headers: owner, body });

  const inbox = async (query = "") => (await api("GET", `/inbox${query}`)).body;
  const find = async (googleId: string, filter = "all") =>
    ((await inbox(`?filter=${filter}`)).data as Json[]).find(
      (r) => r.reviewId === googleId,
    )!;

  beforeAll(async () => {
    resetMockPlay();
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    await db
      .delete(otpChallenges)
      .where(eq(otpChallenges.phone, `+91${OWNER}`));
    const mobile = { "x-client": "mobile" };
    await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: mobile,
      body: { phone: OWNER },
    });
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: mobile,
      body: { phone: OWNER, code: "123456" },
    });
    owner = {
      "x-client": "mobile",
      authorization: `Bearer ${res.body.accessToken as string}`,
    };
  });

  afterAll(async () => {
    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.phone, [`+91${OWNER}`]));
    for (const user of rows) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await app.close();
  });

  it("drafts with AI on the first sync and lists every app in one inbox", async () => {
    const settings = await api("GET", "/workspace");
    expect(settings.body).toMatchObject({
      aiMode: "platform",
      aiReady: true,
      model: "claude-opus-5",
      agentsCanPost: false,
      token: null,
      connected: false,
    });
    const connection = await api("POST", "/connections", {
      key: JSON.stringify({
        type: "service_account",
        project_id: "acme-play",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n",
        client_email: "replyly@acme-play.iam.gserviceaccount.com",
      }),
    });
    const added = await api("POST", "/apps", {
      connectionId: connection.body.id,
      packageName: "com.acme.notes",
    });
    appId = added.body.id as string;
    await api("PUT", `/apps/${appId}`, {
      variables: { support_email: "help@acme.app", developer_name: "Sam" },
    });

    const list = await inbox();
    expect(list.counts).toEqual({ pending: 8, replied: 0, all: 8 });
    expect(list.approvable).toHaveLength(8);
    const ones = await inbox(`?appId=${appId}&stars=1`);
    expect(ones.counts.pending).toBe(2);
    expect((ones.data as Json[]).every((r) => r.stars === 1)).toBe(true);
    expect((await api("GET", "/inbox?stars=6")).statusCode).toBe(400);
    const crash = (list.data as Json[]).find((r) => r.reviewId === "gp-2")!;
    expect(crash).toMatchObject({
      appId,
      topic: "Crash",
      state: "waiting",
      draft: { source: "ai", status: "pending_approval" },
    });
    const ai = app.get<MockReplyAi>(REPLY_AI);
    expect(ai.calls.length).toBeGreaterThanOrEqual(8);
    expect(ai.calls[0]).toMatchObject({
      appName: "Acme Notes",
      tone: "friendly",
      translate: true,
      personalize: true,
    });
    expect((await inbox(`?appId=${appId}&filter=replied`)).data).toEqual([]);
  });

  it("rewrites, skips, drafts on request and approves everything at once", async () => {
    const crash = await find("gp-2");
    const rewritten = await api(
      "POST",
      `/reviews/${crash.id as string}/rewrite`,
    );
    expect(rewritten.body.draft.text).not.toBe(crash.draft.text);
    expect(app.get<MockReplyAi>(REPLY_AI).calls.at(-1)!.avoid).toBe(
      crash.draft.text,
    );

    const scam = await find("gp-7");
    const skipped = await api("POST", `/reviews/${scam.id as string}/skip`);
    expect(skipped.body).toMatchObject({ state: "skipped", draft: null });
    expect((await inbox()).counts).toMatchObject({ pending: 7, replied: 1 });
    expect((await find("gp-7", "replied")).state).toBe("skipped");
    const drafted = await api("POST", `/reviews/${scam.id as string}/draft`);
    expect(drafted.body).toMatchObject({
      state: "waiting",
      skippedAt: null,
      draft: { source: "ai" },
    });

    await api("PUT", "/workspace", { aiMode: "off" });
    const noAi = await api("POST", `/reviews/${scam.id as string}/rewrite`);
    expect(noAi.statusCode).toBe(400);
    expect(noAi.body.message).toContain("Rewriting needs AI drafting");
    await api("PUT", "/workspace", { aiMode: "platform" });

    const { approvable } = await inbox();
    const result = await api("POST", "/inbox/approve-all", {
      replyIds: approvable,
    });
    expect(result.body).toEqual({ sent: 8, failed: [] });
    const after = await inbox();
    expect(after.counts).toMatchObject({ pending: 0, replied: 8 });
    expect((await find("gp-2", "replied")).sentVia).toMatchObject({
      auto: false,
      source: "ai",
    });
  });

  it("reports analytics with deltas, topics and time saved", async () => {
    const bad = await api("GET", "/analytics?days=12");
    expect(bad.statusCode).toBe(400);
    const all = await api("GET", "/analytics?days=30");
    expect(all.body).toMatchObject({
      days: 30,
      current: { reviews: 8, replied: 8, replyRate: 100 },
      repliesSent: 8,
      timeSavedHours: 0.2,
    });
    expect(all.body.series).toHaveLength(30);
    expect(all.body.distribution).toHaveLength(5);
    expect((all.body.topics as Json[]).map((t) => t.topic)).toContain("Crash");
    const one = await api("GET", `/analytics?days=7&appId=${appId}`);
    expect(one.body.series).toHaveLength(7);
    const today = new Date().toISOString().slice(0, 10);
    const custom = await api(
      "GET",
      `/analytics?from=2026-01-01&to=${today}&appId=${appId}`,
    );
    expect(custom.body).toMatchObject({
      bucket: "week",
      current: { reviews: 8 },
    });
    const forever = await api("GET", "/analytics?all=true");
    expect(forever.body.current.reviews).toBeGreaterThanOrEqual(8);
    expect(forever.body.previous.reviews).toBe(0);
    const backwards = await api(
      "GET",
      `/analytics?from=${today}&to=2026-01-01`,
    );
    expect(backwards.statusCode).toBe(400);
    const half = await api("GET", "/analytics?from=2026-01-01");
    expect(half.body.message).toBe("Choose both a start and an end date.");
    const detail = await api("GET", `/apps/${appId}`);
    expect(detail.body).toMatchObject({
      overview: { replyRate: 100 },
      needsReply: 0,
    });
    expect(
      (detail.body.replies14d as number[]).reduce((a, b) => a + b, 0),
    ).toBe(8);
  });

  it("escalates 1-star reviews to Slack and pauses auto-replies when asked", async () => {
    const badHook = await api("PUT", "/workspace", {
      slackWebhook: "https://example.com/hook",
    });
    expect(badHook.statusCode).toBe(400);
    const hooked = await api("PUT", "/workspace", {
      slackWebhook: "https://hooks.slack.com/services/T0/B0/xyz",
      slackChannel: "support",
    });
    expect(hooked.body).toMatchObject({
      slackConnected: true,
      slackChannel: "#support",
    });
    const rules = (await api("GET", `/apps/${appId}`)).body.settings
      .ratingRules as Json[];
    await api("PUT", `/apps/${appId}`, {
      settings: {
        escalate: true,
        delay: "instant",
        quietHours: null,
        ratingRules: rules.map((r) => ({ ...r, mode: "auto" })),
      },
    });
    addMockReview("com.acme.notes", {
      reviewId: "esc-1",
      authorName: "Kiran",
      stars: 1,
      text: "Lost all my notes",
    });
    await api("POST", `/apps/${appId}/sync`);
    const notifier = app.get<MockNotifier>(ESCALATION_NOTIFIER);
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]).toMatchObject({
      webhookUrl: "https://hooks.slack.com/services/T0/B0/xyz",
      escalation: {
        appName: "Acme Notes",
        stars: 1,
        text: "Lost all my notes",
      },
    });
    expect(notifier.sent[0]!.escalation.draft).toBeTruthy();
    await api("POST", `/apps/${appId}/sync`);
    expect(notifier.sent).toHaveLength(1);

    await db
      .update(playApps)
      .set({
        pausedUntil: new Date(Date.now() + 3_600_000),
        pauseReason: "Safety pause: test",
      })
      .where(eq(playApps.id, appId));
    addMockReview("com.acme.notes", {
      reviewId: "pause-1",
      authorName: "Lee",
      stars: 5,
      text: "Back to great",
    });
    await api("POST", `/apps/${appId}/sync`);
    expect(await find("pause-1", "pending")).toMatchObject({
      state: "waiting",
      draft: { auto: false, note: "Safety pause: test" },
    });
    expect((await api("GET", "/apps")).body.data[0].pauseReason).toBe(
      "Safety pause: test",
    );
    const resumed = await api("POST", `/apps/${appId}/resume`);
    expect(resumed.body).toMatchObject({
      pausedUntil: null,
      pauseReason: null,
    });
    expect(await app.get(PlayEngine).sendDue()).toMatchObject({ failed: 0 });
  });

  it("imports review history from the Play Console reports bucket", async () => {
    const connectionId = (await api("GET", "/connections")).body.data[0]
      .id as string;
    const none = await api("POST", `/apps/${appId}/history`);
    expect(none.body.message).toContain("reports URI first");
    const bad = await api("PUT", `/connections/${connectionId}/reports`, {
      uri: "gs://my-bucket/reviews/",
    });
    expect(bad.statusCode).toBe(400);
    const denied = await api("PUT", `/connections/${connectionId}/reports`, {
      uri: "gs://pubsite_prod_denied123/reviews/",
    });
    expect(denied.statusCode).toBe(200);
    expect(denied.body.data[0].reportsBucket).toBe("pubsite_prod_denied123");
    expect((await api("GET", `/apps/${appId}`)).body.history.error).toContain(
      "download bulk reports",
    );
    const saved = await api("PUT", `/connections/${connectionId}/reports`, {
      uri: "gs://pubsite_prod_8366263714187534872/reviews/",
    });
    expect(saved.body.data[0].reportsBucket).toBe(
      "pubsite_prod_8366263714187534872",
    );

    const first = await api("POST", `/apps/${appId}/history`);
    expect(first.body).toMatchObject({
      files: 2,
      changed: 2,
      rows: 6,
      imported: 6,
    });
    const again = await api("POST", `/apps/${appId}/history`);
    expect(again.body).toMatchObject({ files: 2, changed: 0, imported: 0 });
    const forced = await api("POST", `/apps/${appId}/history?all=true`);
    expect(forced.body).toMatchObject({ changed: 2, rows: 6, imported: 0 });
    const detail = await api("GET", `/apps/${appId}`);
    expect(detail.body.history).toMatchObject({
      bucket: "pubsite_prod_8366263714187534872",
      files: 2,
      error: null,
    });
    expect(
      await app
        .get(PlayEngine)
        .repo.appsDueForHistory(
          new Date(Date.now() - 86_400_000),
          new Date(),
          10,
        ),
    ).toEqual([]);
    const insights = await api("GET", `/apps/${appId}/insights?days=90`);
    expect(insights.body.complaints.map((w: Json) => w.word)).toContain(
      "login",
    );
  });

  it("flags apps that lost reply access and rechecks them", async () => {
    await db
      .update(playApps)
      .set({ syncErrorKind: "no_permission", syncError: "403" })
      .where(eq(playApps.id, appId));
    expect((await api("GET", "/apps")).body.data[0].mode).toBe("needs_access");
    const rechecked = await api("POST", `/apps/${appId}/recheck`);
    expect(rechecked.body).toMatchObject({
      syncErrorKind: null,
      mode: "auto",
    });
  });

  it("hides an app that loses access and brings it back when access returns", async () => {
    await db
      .update(playApps)
      .set({ packageName: "com.acme.notes.denied" })
      .where(eq(playApps.id, appId));
    const synced = await api("POST", `/apps/${appId}/sync`);
    expect(synced.body).toMatchObject({ archived: true, fetched: 0 });
    expect((await api("GET", "/apps")).body.data).toEqual([]);
    expect((await inbox()).counts.pending).toBe(0);
    expect((await api("GET", `/apps/${appId}`)).statusCode).toBe(200);

    await db
      .update(playApps)
      .set({ packageName: "com.acme.notes" })
      .where(eq(playApps.id, appId));
    const back = await api("POST", `/apps/${appId}/recheck`);
    expect(back.body).toMatchObject({ syncErrorKind: null });
    expect(
      ((await api("GET", "/apps")).body.data as Json[]).map((a) => a.id),
    ).toEqual([appId]);
  });

  it("suggests placeholder values from the store listing and past replies", async () => {
    const res = await api("GET", `/apps/${appId}/variable-suggestions`);
    expect(res.body.repliesRead).toBeGreaterThan(0);
    expect(res.body.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "support_email",
          value: "help@acmenotes.example",
          source: "play_listing",
        }),
        expect.objectContaining({
          key: "support_url",
          value: "https://acmenotes.example",
          source: "play_listing",
        }),
      ]),
    );
  });
});
