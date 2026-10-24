import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { and, count, eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { BusinessEngine } from "@modules/business/application/business-engine.service";
import { gbpReplies } from "@modules/business/infrastructure/business.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { PlayEngine } from "@modules/play/application/play-engine.service";
import { resetMockPlay } from "@modules/play/infrastructure/mock-play.api";
import { playReplies } from "@modules/play/infrastructure/play.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000019";

type Json = Record<string, any>;

describe("Workspace AI and automation settings", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let workspaceId: string;

  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{ statusCode: number; body: Json; headers: Json }> =>
    call(app, method, `/api/v1${url}`, { headers: owner, body });

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
    workspaceId = (await api("GET", "/settings")).body.workspace.id as string;
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

  it("reads and updates workspace AI and Slack settings for every product", async () => {
    const initial = await api("GET", "/automation/settings");
    expect(initial.statusCode).toBe(200);
    expect(initial.body).toEqual({
      aiMode: "platform",
      platformAi: true,
      aiKeyHint: null,
      aiReady: true,
      model: "claude-opus-5",
      dailyDrafts: 300,
      draftsToday: 0,
      slackConnected: false,
      slackChannel: null,
      agentsCanPost: false,
      agentPermissions: {
        gbpDrafts: true,
        gbpPosts: true,
        gbpInfo: true,
        gbpReplySettings: true,
        gbpProfiles: true,
      },
      notifyNewLeads: true,
    });

    const badKey = await api("PUT", "/automation/settings", {
      aiMode: "own",
      aiKey: "not-a-key",
    });
    expect(badKey.statusCode).toBe(400);
    expect(
      (await api("PUT", "/automation/settings", { aiMode: "sometimes" }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await api("PUT", "/automation/settings", {
          slackWebhook: "https://example.com/hook",
        })
      ).statusCode,
    ).toBe(400);

    const saved = await api("PUT", "/automation/settings", {
      aiMode: "own",
      aiKey: "sk-ant-abcdefghijklmnopqrstuvwxyz1234",
      slackWebhook: "https://hooks.slack.com/services/T000/B000/XXXX",
      slackChannel: "support",
      agentsCanPost: true,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).toMatchObject({
      aiMode: "own",
      aiKeyHint: "sk-ant-…1234",
      aiReady: true,
      slackConnected: true,
      slackChannel: "#support",
      agentsCanPost: true,
    });
    expect(JSON.stringify(saved.body)).not.toContain("abcdefghij");

    const play = await api("GET", "/play/workspace");
    expect(play.body).toMatchObject({
      aiMode: "own",
      aiKeyHint: "sk-ant-…1234",
      slackChannel: "#support",
      agentsCanPost: true,
      token: null,
    });

    const viaPlay = await api("PUT", "/play/workspace", {
      aiMode: "platform",
      slackWebhook: null,
      agentsCanPost: false,
    });
    expect(viaPlay.statusCode).toBe(200);
    expect((await api("GET", "/automation/settings")).body).toMatchObject({
      aiMode: "platform",
      aiKeyHint: "sk-ant-…1234",
      slackConnected: false,
      agentsCanPost: false,
    });

    const audit = (await api("GET", "/audit-events")).body.data as Json[];
    const changes = audit.filter(
      (e) => e.action === "automation.settings_updated",
    );
    expect(changes).toHaveLength(2);
    expect(changes.map((e) => e.data.fields)).toEqual(
      expect.arrayContaining([
        ["aiMode", "aiKey", "slackWebhook", "slackChannel", "agentsCanPost"],
        ["aiMode", "slackWebhook", "agentsCanPost"],
      ]),
    );
    expect(JSON.stringify(audit)).not.toContain("abcdefghij");
  });

  it("counts AI drafts from Play Reviews and Google Business against one daily quota", async () => {
    const connection = await api("POST", "/play/connections", {
      key: JSON.stringify({
        type: "service_account",
        project_id: "acme-play",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n",
        client_email: "replyly@acme-play.iam.gserviceaccount.com",
      }),
    });
    await api("POST", "/play/apps", {
      connectionId: connection.body.id,
      packageName: "com.acme.notes",
    });

    const start = await api("POST", "/business/oauth/start", {
      origin: "http://localhost:3200",
    });
    const url = new URL(start.body.url as string);
    expect(
      (await call(app, "GET", `${url.pathname}${url.search}`)).statusCode,
    ).toBe(302);

    const [play] = await db
      .select({ n: count() })
      .from(playReplies)
      .where(
        and(
          eq(playReplies.workspaceId, workspaceId),
          eq(playReplies.source, "ai"),
        ),
      );
    const [business] = await db
      .select({ n: count() })
      .from(gbpReplies)
      .where(
        and(
          eq(gbpReplies.workspaceId, workspaceId),
          eq(gbpReplies.source, "ai"),
        ),
      );
    expect(play!.n).toBeGreaterThan(0);
    expect(business!.n).toBeGreaterThan(0);
    const total = play!.n + business!.n;

    expect((await api("GET", "/automation/settings")).body).toMatchObject({
      draftsToday: total,
      dailyDrafts: 300,
    });
    expect((await api("GET", "/play/workspace")).body.draftsToday).toBe(total);
    expect(await app.get(PlayEngine).aiAllowance(workspaceId, null)).toBe(
      300 - total,
    );
    expect(await app.get(BusinessEngine).aiAllowance(workspaceId, null)).toBe(
      300 - total,
    );
  });
});
