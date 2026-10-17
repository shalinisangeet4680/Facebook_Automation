import { OTHER, OWNER } from "./play-releases-env";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { and, eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { auditEvents } from "@modules/audit/infrastructure/audit.tables";
import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { ESCALATION_NOTIFIER } from "@modules/engine/domain/ports/notifier";
import { MockNotifier } from "@modules/engine/infrastructure/slack.notifier";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockPlay } from "@modules/play/infrastructure/mock-play.api";
import { RolloutGuardian } from "@modules/play-releases/application/rollout-guardian.service";
import {
  mockReleaseCommits,
  resetMockReleases,
} from "@modules/play-releases/infrastructure/mock-play-releases.api";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const keyFile = (email: string) =>
  JSON.stringify({
    type: "service_account",
    project_id: "acme-play",
    private_key_id: "abc",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----\n",
    client_email: email,
    token_uri: "https://oauth2.googleapis.com/token",
  });

type Json = Record<string, any>;

describe("Play releases and app health", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let other: Record<string, string>;
  let appId: string;
  let steadyId: string;
  let rpcId = 0;

  async function signIn(phone: string) {
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
  }

  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
    headers = owner,
  ): Promise<{ statusCode: number; body: Json }> =>
    call(app, method, `/api/v1${url}`, { headers, body });

  const releases = (
    url: string,
    method: "GET" | "POST" | "PUT" = "GET",
    body?: unknown,
  ) => api(method, `/play-releases/apps/${appId}${url}`, body);

  async function tool(
    token: string,
    name: string,
    args: Record<string, unknown> = {},
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
      payload: {
        jsonrpc: "2.0",
        id: ++rpcId,
        method: "tools/call",
        params: { name, arguments: args },
      },
    });
    expect(res.statusCode).toBe(200);
    const result = (JSON.parse(res.body) as Json).result as {
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
    return { isError: Boolean(result.isError), text, data };
  }

  const production = (overview: Json) =>
    (overview.tracks as Json[]).find((t) => t.track === "production")!;

  beforeAll(async () => {
    resetMockPlay();
    resetMockReleases();
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
    const connection = await api("POST", "/play/connections", {
      key: keyFile("releases@acme-play.iam.gserviceaccount.com"),
    });
    expect(connection.statusCode).toBe(201);
    const added = await api("POST", "/play/apps", {
      connectionId: connection.body.id,
      packageName: "com.acme.rocket",
    });
    expect(added.statusCode).toBe(201);
    appId = added.body.id as string;
    const steady = await api("POST", "/play/apps", {
      connectionId: connection.body.id,
      packageName: "com.acme.steady",
    });
    steadyId = steady.body.id as string;
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

  it("lists every track with its releases, rollout and listing languages", async () => {
    const res = await releases("");
    expect(res.statusCode).toBe(200);
    expect(res.body.app).toMatchObject({
      id: appId,
      packageName: "com.acme.rocket",
    });
    expect((res.body.tracks as Json[]).map((t) => [t.track, t.label])).toEqual([
      ["production", "Production"],
      ["beta", "Open testing"],
      ["alpha", "Closed testing"],
      ["internal", "Internal testing"],
    ]);
    expect(production(res.body).releases).toEqual([
      expect.objectContaining({
        name: "2.4.0",
        versionCodes: ["240"],
        status: "inProgress",
        rolloutPercent: 10,
      }),
      expect.objectContaining({
        versionCodes: ["231"],
        status: "completed",
        rolloutPercent: 100,
      }),
    ]);
    expect(res.body.languages).toEqual(["en-US", "hi-IN", "es-419", "pt-BR"]);
    expect(res.body.guardian).toMatchObject({
      enabled: false,
      maxCrashRate: 1.09,
      maxAnrRate: 0.47,
      lastStatus: null,
    });
    expect(res.body.events).toEqual([]);

    const stranger = await api(
      "GET",
      `/play-releases/apps/${appId}`,
      undefined,
      other,
    );
    expect(stranger.statusCode).toBe(404);
  });

  it("increases a staged rollout through a committed edit and refuses to lower it", async () => {
    const up = await releases("/rollout", "POST", {
      track: "production",
      action: "increase",
      fraction: 0.25,
    });
    expect(up.statusCode).toBe(200);
    expect(up.body.summary).toBe(
      "Increase the rollout of 2.4.0 from 10% to 25%",
    );
    expect(up.body.track.releases[0]).toMatchObject({
      versionCodes: ["240"],
      rolloutPercent: 25,
    });
    expect(mockReleaseCommits).toHaveLength(1);

    const down = await releases("/rollout", "POST", {
      track: "production",
      action: "increase",
      fraction: 0.2,
    });
    expect(down.statusCode).toBe(400);
    expect(down.body.message).toContain("already at 25%");
    const none = await releases("/rollout", "POST", {
      track: "beta",
      action: "halt",
    });
    expect(none.statusCode).toBe(400);
    expect(mockReleaseCommits).toHaveLength(1);

    const [event] = (await releases("")).body.events as Json[];
    expect(event).toMatchObject({
      kind: "increased",
      actor: "user",
      versionCodes: ["240"],
    });
  });

  it("drafts release notes in every listing language and saves them on the release", async () => {
    const drafted = await releases("/notes/draft", "POST", {
      changelog: "- New checkout\n- Saved addresses\n- Fixed crash on orders",
      versionName: "2.4.0",
    });
    expect(drafted.statusCode).toBe(200);
    expect((drafted.body.notes as Json[]).map((n) => n.language)).toEqual([
      "en-US",
      "hi-IN",
      "es-419",
      "pt-BR",
    ]);
    expect(drafted.body.notes[0].text).toContain("New checkout");
    expect(drafted.body.notes.every((n: Json) => n.length <= 500)).toBe(true);

    const tooLong = await releases("/notes", "PUT", {
      track: "production",
      versionCode: "240",
      notes: [{ language: "en-US", text: "x".repeat(501) }],
    });
    expect(tooLong.statusCode).toBe(400);

    const saved = await releases("/notes", "PUT", {
      track: "production",
      versionCode: "240",
      notes: (drafted.body.notes as Json[]).map((n) => ({
        language: n.language,
        text: n.text,
      })),
    });
    expect(saved.statusCode).toBe(200);
    const notes = production((await releases("")).body).releases[0]
      .notes as Json[];
    expect(notes.map((n) => n.language)).toEqual([
      "en-US",
      "hi-IN",
      "es-419",
      "pt-BR",
    ]);
  });

  it("halts a crashing rollout automatically, records it and alerts Slack", async () => {
    await api("PUT", "/play/workspace", {
      slackWebhook: "https://hooks.slack.com/services/T0/B0/rel",
    });
    const bad = await releases("/guardian", "PUT", { maxCrashRate: 0 });
    expect(bad.statusCode).toBe(400);
    const on = await releases("/guardian", "PUT", { enabled: true });
    expect(on.body).toMatchObject({ enabled: true, maxCrashRate: 1.09 });

    const notifier = app.get<MockNotifier>(ESCALATION_NOTIFIER);
    const before = notifier.alerts.length;
    const guardian = app.get(RolloutGuardian);
    const tick = await guardian.tick();
    expect(tick).toMatchObject({ halted: 1, failed: 0 });

    const overview = (await releases("")).body;
    expect(production(overview).releases[0]).toMatchObject({
      versionCodes: ["240"],
      status: "halted",
      rolloutPercent: 25,
    });
    expect(overview.guardian.lastStatus).toBe("halted");
    expect(overview.guardian.lastMessage).toContain(
      "User-perceived crash rate",
    );
    expect(overview.events[0]).toMatchObject({
      kind: "auto_halted",
      actor: "guardian",
      versionCodes: ["240"],
    });
    expect(notifier.alerts.length).toBe(before + 1);
    expect(notifier.alerts.at(-1)!.alert).toMatchObject({
      title: "Rollout halted: Acme Rocket 2.4.0",
      url: `http://localhost:3200/reviews/releases?app=${appId}`,
    });
    const audit = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.target, appId),
          eq(auditEvents.action, "play.release_auto_halted"),
        ),
      );
    expect(audit).toHaveLength(1);

    expect((await guardian.tick()).checked).toBe(0);
  });

  it("lets the owner resume a halted rollout without the guardian halting it again", async () => {
    const resumed = await releases("/rollout", "POST", {
      track: "production",
      action: "resume",
    });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.body.track.releases[0]).toMatchObject({
      status: "inProgress",
      rolloutPercent: 25,
    });
    const check = await releases("/guardian/check", "POST");
    expect(check.body).toMatchObject({
      ignoredVersion: "240",
      lastStatus: "ok",
      halted: [],
    });
    expect(check.body.lastMessage).toContain("skipped because you resumed it");
  });

  it("keeps healthy rollouts going", async () => {
    await api("PUT", `/play-releases/apps/${steadyId}/guardian`, {
      enabled: true,
    });
    const check = await api(
      "POST",
      `/play-releases/apps/${steadyId}/guardian/check`,
    );
    expect(check.body).toMatchObject({ lastStatus: "ok", halted: [] });
    expect(check.body.lastMessage).toContain("healthy at 10%");
  });

  it("shows crash and ANR rates against the thresholds", async () => {
    const res = await releases("/health?days=28");
    expect(res.statusCode).toBe(200);
    expect(res.body.thresholds).toEqual({
      crash: 1.09,
      anr: 0.47,
      googleCrash: 1.09,
      googleAnr: 0.47,
    });
    expect(res.body.crash.length).toBeGreaterThanOrEqual(27);
    expect(res.body.anr.length).toBe(res.body.crash.length);
    const versions = res.body.versions as Json[];
    expect(versions.map((v) => v.versionCode)).toEqual(["240", "231", "229"]);
    expect(versions[0]).toMatchObject({
      name: "2.4.0",
      overCrash: true,
      overAnr: false,
    });
    expect(versions[1]).toMatchObject({ overCrash: false });
    expect(res.body.rollouts).toEqual([
      expect.objectContaining({
        track: "production",
        versionCodes: ["240"],
        rolloutPercent: 25,
      }),
    ]);
    expect((await releases("/health?days=3")).statusCode).toBe(400);
  });

  it("lists crash clusters and explains one with the files likely involved", async () => {
    const all = await releases("/issues");
    expect((all.body.data as Json[]).map((i) => i.id)).toEqual([
      "c1001",
      "a2002",
      "c3003",
      "c4004",
    ]);
    const anrs = await releases("/issues?type=ANR");
    expect((anrs.body.data as Json[]).map((i) => i.type)).toEqual(["ANR"]);

    const detail = await releases("/issues/c1001");
    expect(detail.statusCode).toBe(200);
    expect(detail.body.files).toEqual([
      "com/acme/rocket/orders/OrdersAdapter.kt:87",
      "com/acme/rocket/orders/OrdersAdapter.kt:31",
      "com/acme/rocket/orders/OrdersFragment.kt:142",
    ]);
    expect(detail.body.devices[0]).toEqual({
      value: "Samsung Galaxy A05",
      count: 1,
    });
    expect(detail.body.reports[0].reportText).toContain("NullPointerException");

    const explained = await releases("/issues/c1001/explain", "POST");
    expect(explained.statusCode).toBe(200);
    expect(explained.body).toMatchObject({
      issueId: "c1001",
      summary: expect.stringContaining("crashes"),
      files: detail.body.files,
    });
    expect((await releases("/issues/zzz")).statusCode).toBe(404);
    expect((await releases("/issues/bad%20id")).statusCode).toBe(400);
  });

  it("promotes a tested build to a staged production rollout, then completes it", async () => {
    const promoted = await releases("/promote", "POST", {
      fromTrack: "beta",
      toTrack: "production",
      mode: "staged",
      fraction: 0.05,
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.body.summary).toBe(
      "Start a staged rollout of 2.5.0 on Production at 5%",
    );
    expect(
      (promoted.body.track.releases as Json[]).map((r) => [
        r.versionCodes[0],
        r.status,
      ]),
    ).toEqual([
      ["250", "inProgress"],
      ["231", "completed"],
    ]);
    const older = await releases("/promote", "POST", {
      fromTrack: "production",
      toTrack: "beta",
      mode: "completed",
    });
    expect(older.statusCode).toBe(400);

    const done = await releases("/rollout", "POST", {
      track: "production",
      action: "complete",
    });
    expect(
      (done.body.track.releases as Json[]).map((r) => [
        r.versionCodes[0],
        r.status,
      ]),
    ).toEqual([["250", "completed"]]);
  });

  it("explains missing vitals permission", async () => {
    const connection = await api("POST", "/play/connections", {
      key: keyFile("novitals@acme-play.iam.gserviceaccount.com"),
    });
    const added = await api("POST", "/play/apps", {
      connectionId: connection.body.id,
      packageName: "com.acme.blind",
    });
    const res = await api("GET", `/play-releases/apps/${added.body.id}/health`);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("View app quality information");
  });

  it("gives Claude release tools and confirms rollout changes", async () => {
    const revealed = await api("POST", "/play/workspace/token/reveal");
    const token = revealed.body.token as string;

    const listed = await tool(token, "list_play_releases", {
      app_id: steadyId,
    });
    expect(listed.isError).toBe(false);
    expect(listed.data.tracks[0]).toMatchObject({ track: "production" });
    expect(listed.data.url).toBe(
      `http://localhost:3200/reviews/releases?app=${steadyId}`,
    );

    const health = await tool(token, "get_app_health", {
      app_id: steadyId,
      days: 7,
    });
    expect(health.data.top_clusters).toHaveLength(4);
    expect(health.data.thresholds.crash).toBe(1.09);

    const crash = await tool(token, "explain_crash", {
      app_id: steadyId,
      issue_id: "a2002",
    });
    expect(crash.data.likely_files[0]).toBe(
      "com/acme/steady/settings/Prefs.kt:22",
    );
    expect(crash.data.stack_traces).toHaveLength(1);

    const notes = await tool(token, "draft_release_notes", {
      app_id: steadyId,
      changelog: "Dark mode",
      languages: ["en-US", "hi-IN"],
    });
    expect(notes.data.notes).toHaveLength(2);

    const args = { app_id: steadyId, track: "production", action: "halt" };
    const first = await tool(token, "update_rollout", args);
    expect(first.data).toMatchObject({
      status: "confirmation_required",
      summary: ["Halt the rollout of 2.4.0 at 10%"],
    });
    const wrong = await tool(token, "update_rollout", {
      ...args,
      action: "complete",
      confirm_token: first.data.confirmToken,
    });
    expect(wrong.data.status).toBe("invalid_confirmation");
    const second = await tool(token, "update_rollout", args);
    const applied = await tool(token, "update_rollout", {
      ...args,
      confirm_token: second.data.confirmToken,
    });
    expect(applied.data.status).toBe("applied");
    expect(applied.data.result.track.releases[0].status).toBe("halted");
    const [event] = (await api("GET", `/play-releases/apps/${steadyId}`)).body
      .events as Json[];
    expect(event).toMatchObject({ kind: "halted", actor: "claude" });

    const again = await tool(token, "update_rollout", args);
    expect(again.isError).toBe(true);
    expect(again.text).toContain("already halted");
  });
});
