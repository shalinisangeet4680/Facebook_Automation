import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { PlayEngine } from "@modules/play/application/play-engine.service";
import {
  addMockReview,
  resetMockPlay,
} from "@modules/play/infrastructure/mock-play.api";
import { playReplies } from "@modules/play/infrastructure/play.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000015";
const OTHER = "9000000016";

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

describe("Play review replies", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let other: Record<string, string>;
  let connectionId: string;
  let appId: string;

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
    call(app, method, `/api/v1/play${url}`, { headers, body });

  const reviews = async (query = "") =>
    (await api("GET", `/apps/${appId}/reviews${query}`)).body as Json;

  const byGoogleId = async (googleId: string) =>
    ((await reviews("?pageSize=100")).data as Json[]).find(
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

  it("connects a Google Play service account and explains bad keys", async () => {
    const wrong = await api("POST", "/connections", {
      key: '{"type":"authorized_user","client_id":"x"}',
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.body.message).toContain("not a service account");

    const revoked = await api("POST", "/connections", {
      key: keyFile("revoked@acme-play.iam.gserviceaccount.com"),
    });
    expect(revoked.statusCode).toBe(400);
    expect(revoked.body.message).toContain("Google rejected this key");

    const ok = await api("POST", "/connections", {
      key: keyFile("autopilot@acme-play.iam.gserviceaccount.com"),
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.body).toMatchObject({
      clientEmail: "autopilot@acme-play.iam.gserviceaccount.com",
      status: "active",
    });
    connectionId = ok.body.id as string;

    const list = await api("GET", "/connections");
    expect(list.body.data).toEqual([
      expect.objectContaining({
        id: connectionId,
        apps: 0,
        projectId: "acme-play",
      }),
    ]);
    expect(JSON.stringify(list.body)).not.toContain("PRIVATE KEY");
  });

  it("adds an app, reads its listing and drafts replies for approval on the first sync", async () => {
    const bad = await api("POST", "/apps", {
      connectionId,
      packageName: "acme shop",
    });
    expect(bad.statusCode).toBe(400);
    const denied = await api("POST", "/apps", {
      connectionId,
      packageName: "com.acme.denied",
    });
    expect(denied.statusCode).toBe(400);
    expect(denied.body.message).toContain('give it "Reply to reviews"');

    const added = await api("POST", "/apps", {
      connectionId,
      packageName: "com.acme.shop",
    });
    expect(added.statusCode).toBe(201);
    appId = added.body.id as string;
    expect(added.body).toMatchObject({
      title: "Acme Shop",
      automation: true,
      mode: "approval",
      firstSync: { fetched: 8, created: 8, drafts: 8 },
      settings: { timezone: "Asia/Kolkata", dailyAutoLimit: 50 },
    });
    expect(added.body.suggestedVariables).toContain("support_email");

    const again = await api("POST", "/apps", {
      connectionId,
      packageName: "com.acme.shop",
    });
    expect(again.body.message).toBe("com.acme.shop is already connected.");

    const cards = (await api("GET", "/apps")).body.data as Json[];
    expect(cards[0]).toMatchObject({
      needsReply: 8,
      waiting: 8,
      needsClaude: 0,
      reviews30d: 8,
    });
    expect(cards[0]!.rating).toBeCloseTo(3.25, 2);

    const list = await reviews("?state=waiting&pageSize=100");
    expect(list.total).toBe(8);
    expect(list.counts).toMatchObject({ waiting: 8, replied: 0 });
    expect(list.languages).toEqual(["en", "hi", "pt"]);

    const crash = await byGoogleId("gp-2");
    expect(crash.draft).toMatchObject({
      status: "pending_approval",
      source: "template",
      auto: false,
    });
    expect(crash.draft.text).toMatch(/Rahul|report|flagging/);
    expect(crash.draft.text).not.toContain("{{");

    const anonymous = await byGoogleId("gp-3");
    expect(anonymous.draft.text).not.toContain("Google user");

    const hindi = await byGoogleId("gp-5");
    expect(hindi.draft.text).toMatch(/धन्यवाद|शुक्रिया/);
    expect(hindi.originalText).toBe("बहुत अच्छा ऐप, बहुत मददगार");

    const oneStar = await reviews("?stars=1&pageSize=100");
    expect(
      (oneStar.data as Json[])
        .map((r) => r.reviewId as string)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(["gp-2", "gp-7"]);
    expect((await reviews("?q=refund")).total).toBe(1);
  });

  it("approves, edits, discards, replies directly and bulk-replies", async () => {
    const five = await byGoogleId("gp-1");
    const approved = await api(
      "POST",
      `/replies/${five.draft.id as string}/approve`,
      {
        text: "Thank you Priya, glad you love it!",
      },
    );
    expect(approved.statusCode).toBe(200);
    expect(approved.body).toMatchObject({
      state: "replied",
      reply: { text: "Thank you Priya, glad you love it!" },
      draft: null,
    });

    const mixed = await byGoogleId("gp-6");
    const tooLong = await api(
      "POST",
      `/apps/${appId}/reviews/${mixed.id as string}/reply`,
      { text: "x".repeat(351) },
    );
    expect(tooLong.statusCode).toBe(400);
    const direct = await api(
      "POST",
      `/apps/${appId}/reviews/${mixed.id as string}/reply`,
      {
        text: "Thanks Neha, we're making it faster.",
      },
    );
    expect(direct.body).toMatchObject({
      state: "replied",
      reply: { text: "Thanks Neha, we're making it faster." },
    });

    const scam = await byGoogleId("gp-7");
    const discarded = await api(
      "POST",
      `/replies/${scam.draft.id as string}/discard`,
    );
    expect(discarded.body).toMatchObject({ state: "unreplied", draft: null });

    const templates = (await api("GET", `/templates?appId=${appId}`))
      .body as Json;
    const thanks = (templates.data as Json[]).find(
      (t) => t.presetKey === "thanks",
    )!;
    const [hindi, portuguese] = [
      await byGoogleId("gp-5"),
      await byGoogleId("gp-8"),
    ];
    const preview = await api("POST", `/apps/${appId}/preview`, {
      reviewId: hindi.id,
      templateId: thanks.id,
    });
    expect(preview.body).toMatchObject({
      language: "hi",
      missing: [],
      tooLong: false,
      max: 350,
    });

    const bulk = await api("POST", `/apps/${appId}/bulk-reply`, {
      reviewIds: [hindi.id, portuguese.id],
      templateId: thanks.id,
    });
    expect(bulk.body).toEqual({ sent: 2, held: [], failed: [] });
    expect((await byGoogleId("gp-8")).reply.text).toMatch(/Lucas|Thanks|Thank/);

    const counts = (await reviews()).counts as Json;
    expect(counts).toMatchObject({ replied: 4, waiting: 3, unreplied: 1 });
  });

  it("stores placeholder values and checks templates against them", async () => {
    const bad = await api("PUT", `/apps/${appId}`, {
      variables: { "Support Email": "x" },
    });
    expect(bad.statusCode).toBe(400);
    const builtIn = await api("PUT", `/apps/${appId}`, {
      variables: { first_name: "x" },
    });
    expect(builtIn.body.message).toContain("filled in automatically");

    const saved = await api("PUT", `/apps/${appId}`, {
      variables: {
        support_email: "help@acme.in",
        support_phone: "+91 98765 43210",
        team_name: "Team Acme",
        blank: "",
      },
      settings: { quietHours: null, translateTo: "en" },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body.variables).toEqual({
      support_email: "help@acme.in",
      support_phone: "+91 98765 43210",
      team_name: "Team Acme",
    });
    expect(saved.body.settings.quietHours).toBeNull();
    expect(
      (
        await api("PUT", `/apps/${appId}`, {
          settings: { timezone: "Mars/Base" },
        })
      ).statusCode,
    ).toBe(400);

    const created = await api("POST", "/templates", {
      name: "Call us",
      category: "negative",
      bodies: [
        {
          language: "en",
          variants: [
            "Sorry {{first_name|there}}! Call {{support_phone}} or {{hotline}}. – {{team_name}}",
          ],
        },
      ],
      appId,
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.problems.map((p: Json) => p.problem)).toEqual([
      "{{hotline}} has no value in this app's settings and no fallback",
    ]);

    const scam = await byGoogleId("gp-7");
    const preview = await api("POST", `/apps/${appId}/preview`, {
      reviewId: scam.id,
      templateId: created.body.id,
    });
    expect(preview.body).toMatchObject({
      text: "Sorry Vikram! Call +91 98765 43210 or. – Team Acme",
      missing: ["hotline"],
      note: "Add {{hotline}} in this app's settings, or edit the reply.",
    });

    const updated = await api(
      "PUT",
      `/templates/${created.body.id as string}`,
      {
        name: "Call us",
        category: "negative",
        bodies: [
          {
            language: "en",
            variants: [
              "Sorry {{first_name|there}}! Call {{support_phone}}. – {{team_name}}",
            ],
          },
        ],
        appId,
      },
    );
    expect(updated.body.problems).toEqual([]);

    const otherApps = await api("GET", "/templates");
    expect(
      (otherApps.body.data as Json[]).some((t) => t.id === created.body.id),
    ).toBe(false);

    const thanks = ((await api("GET", "/templates")).body.data as Json[]).find(
      (t) => t.presetKey === "thanks",
    )!;
    const inUse = await api("DELETE", `/templates/${thanks.id as string}`);
    expect(inUse.statusCode).toBe(400);
    expect(inUse.body.message).toContain("Thank happy reviewers");
    const feature = ((await api("GET", "/templates")).body.data as Json[]).find(
      (t) => t.presetKey === "feature",
    )!;
    expect(
      (await api("DELETE", `/templates/${feature.id as string}`)).statusCode,
    ).toBe(204);
    expect((await api("POST", "/templates/presets")).body).toEqual({
      restored: 1,
    });
  });

  it("sends automatic replies within the safeguards", async () => {
    const templates = (await api("GET", `/templates?appId=${appId}`)).body
      .data as Json[];
    const thanks = templates.find((t) => t.presetKey === "thanks")!;
    const negative = templates.find((t) => t.presetKey === "negative")!;
    const saved = await api("PUT", `/apps/${appId}/rules`, {
      rules: [
        {
          name: "Ask Claude about long complaints",
          enabled: true,
          conditions: { stars: [1], keywordsAny: ["claude please"] },
          action: { type: "claude" },
          mode: "auto",
          delayMinutes: 0,
        },
        {
          name: "Thank five stars",
          enabled: true,
          conditions: { stars: [5] },
          action: { type: "template", templateId: thanks.id },
          mode: "auto",
          delayMinutes: 0,
        },
        {
          name: "Unhappy",
          enabled: true,
          conditions: { stars: [1, 2] },
          action: { type: "template", templateId: negative.id },
          mode: "approval",
          delayMinutes: 30,
        },
      ],
    });
    expect(saved.statusCode).toBe(200);
    expect((saved.body.data as Json[]).map((r) => r.mode)).toEqual([
      "approval",
      "auto",
      "approval",
    ]);
    expect((await api("GET", "/apps")).body.data[0].mode).toBe("auto");

    const missing = await api("PUT", `/apps/${appId}/rules`, {
      rules: [
        {
          name: "x",
          enabled: true,
          conditions: {},
          action: { type: "template", templateId: appId },
          mode: "auto",
          delayMinutes: 0,
        },
      ],
    });
    expect(missing.statusCode).toBe(400);

    addMockReview("com.acme.shop", {
      reviewId: "gp-new-1",
      authorName: "Meera Iyer",
      stars: 5,
      text: "Superb!",
    });
    addMockReview("com.acme.shop", {
      reviewId: "gp-new-2",
      authorName: "Arjun",
      stars: 5,
      text: "Great but feels like a scam sometimes",
    });
    addMockReview("com.acme.shop", {
      reviewId: "gp-new-3",
      authorName: "Kiran",
      stars: 1,
      text: "claude please read this long complaint",
    });
    const sync = await api("POST", `/apps/${appId}/sync`);
    expect(sync.body).toMatchObject({ created: 3, drafts: 3 });

    const meera = await byGoogleId("gp-new-1");
    expect(meera).toMatchObject({
      state: "scheduled",
      draft: { auto: true, status: "scheduled" },
    });
    expect(meera.draft.text).toContain("Meera");
    expect(meera.draft.text).toContain("Team Acme");
    expect(await byGoogleId("gp-new-2")).toMatchObject({
      state: "waiting",
      draft: {
        auto: false,
        note: 'Mentions "scam", so it needs your approval.',
      },
    });
    expect(await byGoogleId("gp-new-3")).toMatchObject({
      state: "claude",
      draft: { status: "needs_claude" },
    });

    const engine = app.get(PlayEngine);
    expect(await engine.sendDue()).toEqual({ due: 1, sent: 1, failed: 0 });
    expect(await byGoogleId("gp-new-1")).toMatchObject({
      state: "replied",
      reply: { text: meera.draft.text },
    });

    await api("PUT", `/apps/${appId}`, { settings: { dailyAutoLimit: 1 } });
    addMockReview("com.acme.shop", {
      reviewId: "gp-new-4",
      authorName: "Dev",
      stars: 5,
      text: "Nice",
    });
    await api("POST", `/apps/${appId}/sync`);
    expect((await byGoogleId("gp-new-4")).draft).toMatchObject({
      status: "pending_approval",
      note: "Today's limit of 1 automatic replies is reached.",
    });

    const claudeDraft = await api(
      "PUT",
      `/apps/${appId}/reviews/${(await byGoogleId("gp-new-3")).id as string}/draft`,
      {
        text: "Sorry Kiran, we read every word. Our team will call you today.",
      },
    );
    expect(claudeDraft.body).toMatchObject({
      state: "waiting",
      draft: { status: "pending_approval" },
    });

    await api("PUT", `/apps/${appId}`, { automation: false });
    addMockReview("com.acme.shop", {
      reviewId: "gp-new-5",
      stars: 5,
      text: "Love it",
    });
    expect((await api("POST", `/apps/${appId}/sync`)).body.drafts).toBe(0);
    expect((await api("GET", "/apps")).body.data[0].mode).toBe("off");
  });

  it("notices when a reviewer edits their review after we replied", async () => {
    await api("PUT", `/apps/${appId}`, { automation: true });
    addMockReview("com.acme.shop", {
      reviewId: "gp-6",
      stars: 5,
      text: "Much faster now, thanks!",
      lastModified: new Date(Date.now() + 60_000),
    });
    await api("POST", `/apps/${appId}/sync`);
    const edited = await byGoogleId("gp-6");
    expect(edited).toMatchObject({
      editedAfterReply: true,
      starsBeforeEdit: 3,
      stars: 5,
      state: "waiting",
      reply: { text: "Thanks Neha, we're making it faster." },
      draft: { note: "Today's limit of 1 automatic replies is reached." },
    });
  });

  it("keeps everything inside the workspace and cleans up", async () => {
    expect(
      (await api("GET", `/apps/${appId}`, undefined, other)).statusCode,
    ).toBe(404);
    expect((await api("GET", "/apps", undefined, other)).body.data).toEqual([]);
    const someReply = (await db.select().from(playReplies).limit(1))[0]!;
    expect(
      (await api("POST", `/replies/${someReply.id}/approve`, {}, other))
        .statusCode,
    ).toBe(404);

    expect((await api("DELETE", `/apps/${appId}`)).statusCode).toBe(204);
    expect((await api("GET", "/apps")).body.data).toEqual([]);
    expect(
      (await api("DELETE", `/connections/${connectionId}`)).statusCode,
    ).toBe(204);
    expect((await api("GET", "/connections")).body.data).toEqual([]);
  });
});
