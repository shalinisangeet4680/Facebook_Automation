import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { ESCALATION_NOTIFIER } from "@modules/engine/domain/ports/notifier";
import { workspaceAutomationSettings } from "@modules/engine/infrastructure/engine.tables";
import { MockNotifier } from "@modules/engine/infrastructure/slack.notifier";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { SocialCommentsService } from "@modules/social-engine/application/social-comments.service";
import { SocialEngine } from "@modules/social-engine/application/social-engine.service";
import { SocialInsightsService } from "@modules/social-engine/application/social-insights.service";
import { SOCIAL_API } from "@modules/social-engine/domain/ports/social-api";
import { addDays, weekStartOf } from "@modules/social-engine/domain/time";
import { MockSocialApi } from "@modules/social-engine/infrastructure/mock-social.api";
import {
  socialAccounts,
  socialAutoposts,
  socialCommentReplies,
} from "@modules/social-engine/infrastructure/social-engine.tables";
import { DATABASE, Database } from "@shared/database/database";
import { CryptoService } from "@shared/security/crypto.service";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000027";
const COOKIE = "tv_autopost_state";

type Json = Record<string, any>;

describe("Instagram and Facebook Autopost", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let mock: MockSocialApi;
  let ig: Json;
  let fb: Json;

  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{
    statusCode: number;
    body: Json;
    headers: Json;
    cookies: Json;
  }> => call(app, method, `/api/v1/autopost${url}`, { headers: owner, body });

  const connect = async (login: "facebook" | "instagram", product: string) => {
    const start = await api("POST", "/oauth/start", {
      login,
      product,
      origin: "http://localhost:3200",
    });
    expect(start.statusCode).toBe(200);
    const nonce = start.cookies[COOKIE] as string;
    expect(nonce).toBeTruthy();
    const url = new URL(start.body.url as string);
    return call(app, "GET", `${url.pathname}${url.search}`, {
      cookies: { [COOKIE]: nonce },
    });
  };

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    mock = app.get<MockSocialApi>(SOCIAL_API);
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

  it("connects Pages and Instagram accounts with Facebook and Instagram sign-in", async () => {
    expect((await api("GET", "/status")).body).toMatchObject({
      mock: true,
      facebookLogin: true,
      instagramLogin: true,
      redirectUri: "http://localhost:3200/api/v1/autopost/oauth/callback",
    });
    expect((await api("GET", "/accounts")).body.data).toEqual([]);

    const forged = await call(
      app,
      "GET",
      "/api/v1/autopost/oauth/callback?code=mock-facebook&state=forged",
    );
    expect(forged.statusCode).toBe(302);
    expect(forged.headers.location).toContain("/instagram/accounts?error=");

    const elsewhere = await api("POST", "/oauth/start", {
      login: "facebook",
      product: "instagram",
      origin: "https://evil.example",
    });
    expect(elsewhere.body.url).toContain(
      "http://localhost:3200/api/v1/autopost/oauth/callback",
    );
    const noCookie = new URL(elsewhere.body.url as string);
    const unbound = await call(
      app,
      "GET",
      `${noCookie.pathname}${noCookie.search}`,
    );
    expect(unbound.headers.location).toContain("error=");

    const done = await connect("facebook", "facebook");
    expect(done.statusCode).toBe(302);
    expect(done.headers.location).toBe(
      "http://localhost:3200/facebook/accounts?connected=3",
    );

    const pages = (await api("GET", "/accounts?platform=facebook")).body
      .data as Json[];
    expect(
      pages.map((p) => p.name as string).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["Sharma Dental Clinic", "Sharma Dental Kids"]);
    fb = pages.find((p) => p.name === "Sharma Dental Clinic")!;
    expect(fb).toMatchObject({ login: "facebook", status: "active" });

    const again = await connect("instagram", "instagram");
    expect(again.headers.location).toBe(
      "http://localhost:3200/instagram/accounts?connected=1",
    );
    const igs = (await api("GET", "/accounts?platform=instagram")).body
      .data as Json[];
    expect(
      igs.map((a) => a.username as string).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["sharma.smiles", "sharmadental"]);
    ig = igs.find((a) => a.username === "sharmadental")!;
    expect(ig.pageId).toBe("1301000000000001");

    const stored = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, ig.id as string));
    expect(stored[0]!.tokenCiphertext).not.toContain("mock-page");
    expect(app.get(CryptoService).decrypt(stored[0]!.tokenCiphertext)).toBe(
      "mock-page-1301000000000001",
    );

    const detail = (await api("GET", `/accounts/${ig.id}`)).body;
    expect(detail.settings).toMatchObject({
      timezone: "Asia/Kolkata",
      postsPerWeek: 4,
      modes: { tip: "approval" },
      comments: { modes: { spam: "manual" }, hideSpam: true },
    });
    expect(detail.bestTimes.source).toBe("own");
    expect(detail.bestTimes.slots[0].hour).toBeGreaterThanOrEqual(18);
  });

  it("prefills and saves the brand kit", async () => {
    const empty = (await api("GET", "/brand-kit")).body;
    expect(empty).toMatchObject({ saved: false, kit: { voice: "friendly" } });

    const prefilled = await api("POST", "/brand-kit/prefill", {
      websiteUrl: "https://sharmadental.example.in",
      save: true,
    });
    expect(prefilled.statusCode).toBe(200);
    expect(prefilled.body).toMatchObject({
      saved: true,
      kit: {
        businessType: "Dental clinic",
        city: "Patna",
        cta: "Book an appointment",
        websiteUrl: "https://sharmadental.example.in",
      },
    });
    expect(prefilled.body.kit.hashtagSets[0].tags).toContain("dentist");

    const saved = await api("PUT", "/brand-kit", {
      name: "Sharma Dental",
      colors: { primary: "#0E4D64", accent: "#F2A541" },
      bannedWords: ["guaranteed"],
    });
    expect(saved.body.kit).toMatchObject({
      name: "Sharma Dental",
      colors: { primary: "#0E4D64", secondary: "#F4F1EA", accent: "#F2A541" },
      bannedWords: ["guaranteed"],
    });
    expect(
      (await api("PUT", "/brand-kit", { colors: { primary: "red" } }))
        .statusCode,
    ).toBe(400);
  });

  it("plans a week of posts with brand visuals that wait for approval", async () => {
    const week = addDays(weekStartOf(new Date(), "Asia/Kolkata"), 7);
    const res = await api("POST", "/plans", {
      accountId: ig.id,
      weekStart: week,
    });
    expect(res.statusCode).toBe(200);
    const posts = res.body.posts as Json[];
    expect(posts.length).toBeGreaterThanOrEqual(4);
    expect(res.body.plan.weekStart).toBe(week);
    for (const p of posts) {
      expect(["pending_approval"]).toContain(p.status);
      expect(p.caption).toBeTruthy();
      expect(new Date(p.scheduledAt as string).getTime()).toBeGreaterThan(
        Date.now(),
      );
    }
    const carousel = posts.find((p) => p.format === "carousel");
    expect(carousel?.media).toHaveLength(3);
    const image = posts.find((p) => p.format === "image");
    expect(image?.media[0].url).toMatch(/\/media\/.+\.png$/);

    const regenerated = await api("POST", "/plans", {
      accountId: ig.id,
      weekStart: week,
    });
    expect((regenerated.body.posts as Json[]).length).toBe(posts.length);
    const calendar = await api(
      "GET",
      `/calendar?platform=instagram&from=${week}T00:00:00%2B05:30&to=${addDays(week, 7)}T00:00:00%2B05:30`,
    );
    expect((calendar.body.data as Json[]).length).toBe(posts.length);
    expect(calendar.body.plans[0].weekStart).toBe(week);

    const first = (regenerated.body.posts as Json[])[0]!;
    const caption = await api("POST", `/posts/${first.id}/regenerate`, {
      part: "caption",
    });
    expect(caption.body.caption).not.toBe(first.caption);

    const approved = await api("POST", "/posts/approve-all", {
      platform: "instagram",
      accountId: ig.id,
    });
    expect(approved.body.approved + approved.body.failed.length).toBe(
      posts.length,
    );
    expect(approved.body.approved).toBeGreaterThan(0);

    expect(
      (
        await api("POST", "/plans", {
          accountId: ig.id,
          weekStart: "2020-01-06",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("publishes from the composer, on schedule and with safeguards", async () => {
    const now = await api("POST", "/posts", {
      accountId: ig.id,
      format: "image",
      contentType: "tip",
      idea: "Brush twice a day for two minutes",
      generateCaption: true,
      generateImage: true,
      firstComment: "Which brush do you use?",
      when: "now",
    });
    expect(now.statusCode).toBe(201);
    expect(now.body).toMatchObject({
      status: "published",
      format: "image",
      aiWritten: true,
    });
    expect(now.body.permalink).toContain("instagram.com");
    const published = mock.published.at(-1)!;
    expect(published.input.caption).toContain("#");
    expect(mock.comments_.at(-1)).toMatchObject({
      text: "Which brush do you use?",
    });

    expect(
      (
        await api("POST", "/posts", {
          accountId: ig.id,
          format: "text",
          caption: "Hello",
          when: "draft",
        })
      ).statusCode,
    ).toBe(400);
    const single = await api("POST", "/posts", {
      accountId: ig.id,
      format: "carousel",
      caption: "Only one slide",
      media: [{ url: "https://cdn.example.com/a.jpg" }],
      when: "schedule",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(single.statusCode).toBe(400);
    expect(single.body.message).toContain("between 2 and 10");
    const banned = await api("POST", "/posts", {
      accountId: ig.id,
      format: "image",
      caption: "Guaranteed results!",
      media: [{ url: "https://cdn.example.com/a.jpg" }],
      when: "now",
    });
    expect(banned.statusCode).toBe(400);
    expect(banned.body.message).toContain("banned word");

    const story = await api("POST", "/posts", {
      accountId: ig.id,
      format: "story",
      idea: "Open on Sunday",
      generateImage: true,
      when: "approval",
    });
    expect(story.body).toMatchObject({
      status: "pending_approval",
      format: "story",
    });
    expect(story.body.scheduledAt).toBeTruthy();
    const ok = await api("POST", `/posts/${story.body.id}/approve`);
    expect(ok.body.status).toBe("scheduled");
    const later = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const moved = await api("PUT", `/posts/${story.body.id}`, {
      scheduledAt: later,
    });
    expect(moved.body.scheduledAt).toBe(later);
    await db
      .update(socialAutoposts)
      .set({ scheduledAt: new Date(Date.now() - 1000) })
      .where(eq(socialAutoposts.id, story.body.id as string));
    const due = await app.get(SocialEngine).publishDue();
    expect(due.published).toBeGreaterThanOrEqual(1);
    expect((await api("GET", `/posts/${story.body.id}`)).body.status).toBe(
      "published",
    );

    const failing = await api("POST", "/posts", {
      accountId: fb.id,
      format: "link",
      caption: "Read our new guide #fail",
      link: "https://sharmadental.example.in/guide",
      when: "now",
    });
    expect(failing.statusCode).toBe(400);
    const failed = (await api("GET", `/posts?platform=facebook&status=failed`))
      .body.data as Json[];
    expect(failed[0]).toMatchObject({ status: "failed", format: "link" });
    expect(failed[0]!.error).toContain("Facebook rejected");

    const text = await api("POST", "/posts", {
      accountId: fb.id,
      format: "text",
      caption: "We are open this Sunday from 10 to 2.",
      when: "now",
    });
    expect(text.body.status).toBe("published");
  });

  it("syncs comments, hides spam on Facebook and drafts replies on the engine", async () => {
    const synced = await api("POST", `/accounts/${fb.id}/sync`);
    expect(synced.statusCode).toBe(200);
    const all = (
      await api(
        "GET",
        `/comments?platform=facebook&accountId=${fb.id}&filter=all`,
      )
    ).body.data as Json[];
    const spam = all.filter((c) => c.class === "spam");
    expect(spam.length).toBeGreaterThan(0);
    expect(spam.every((c) => c.hidden && c.state === "hidden")).toBe(true);
    expect([...mock.hidden.values()].every(Boolean)).toBe(true);

    const open = (
      await api("GET", `/comments?platform=instagram&accountId=${ig.id}`)
    ).body;
    expect(open.counts.open).toBeGreaterThan(0);
    const question = (open.data as Json[]).find(
      (c) => c.class === "question" && c.draft,
    )!;
    expect(question.draft).toMatchObject({
      status: "pending_approval",
      source: "ai",
    });

    const sent = await api(
      "POST",
      `/comment-replies/${question.draft.id}/approve`,
      { text: "We're open 10 to 2 on Sundays!" },
    );
    expect(sent.body).toMatchObject({
      state: "replied",
      reply: { text: "We're open 10 to 2 on Sundays!" },
    });
    expect(mock.replies.at(-1)!.text).toBe("We're open 10 to 2 on Sundays!");

    const praise = (open.data as Json[]).find((c) => c.class === "praise")!;
    const failed = await api("POST", `/comments/${praise.id}/reply`, {
      text: "FAIL_ON_META thanks",
    });
    expect(failed.statusCode).toBe(400);
    expect(
      (
        await api("GET", `/comments?accountId=${ig.id}&filter=all`)
      ).body.data.find((c: Json) => c.id === praise.id).state,
    ).toBe("failed");

    const hidden = await api("POST", `/comments/${praise.id}/hide`, {
      hidden: true,
    });
    expect(hidden.body.state).toBe("hidden");
  });

  it("auto-replies by comment class and escalates complaints to Slack", async () => {
    const crypto = app.get(CryptoService);
    await db
      .insert(workspaceAutomationSettings)
      .values({
        workspaceId: await workspaceOf(),
        slackWebhookCiphertext: crypto.encrypt("https://hooks.slack.test/x"),
      })
      .onConflictDoUpdate({
        target: workspaceAutomationSettings.workspaceId,
        set: {
          slackWebhookCiphertext: crypto.encrypt("https://hooks.slack.test/x"),
        },
      });
    const updated = await api("PUT", `/accounts/${ig.id}`, {
      quietHours: null,
      comments: { modes: { praise: "auto" } },
    });
    expect(updated.body.settings.comments.modes.praise).toBe("auto");

    await api("POST", "/posts", {
      accountId: ig.id,
      format: "image",
      caption: "Our new kids' corner is ready!",
      media: [{ url: "https://cdn.example.com/kids.jpg" }],
      when: "now",
    });
    const account = (
      await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, ig.id as string))
    )[0]!;
    await app.get(SocialCommentsService).sync(account);
    const scheduled = await db
      .select()
      .from(socialCommentReplies)
      .where(eq(socialCommentReplies.status, "scheduled"));
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled.every((r) => r.auto)).toBe(true);
    await db
      .update(socialCommentReplies)
      .set({ sendAt: new Date(Date.now() - 1000) })
      .where(eq(socialCommentReplies.status, "scheduled"));
    const before = mock.replies.length;
    const due = await app.get(SocialCommentsService).sendDue();
    expect(due.sent).toBe(scheduled.length);
    expect(mock.replies.length).toBe(before + scheduled.length);

    const notifier = app.get<MockNotifier>(ESCALATION_NOTIFIER);
    expect(
      notifier.sent.some(
        (s) =>
          s.escalation.subjectName.includes("on Instagram") &&
          s.escalation.text.includes("waited 2 hours"),
      ),
    ).toBe(true);
  });

  it("reports insights, best time and pauses automation on a reported post", async () => {
    const insights = await api(
      "GET",
      `/insights?platform=instagram&accountId=${ig.id}&days=30`,
    );
    expect(insights.statusCode).toBe(200);
    expect(insights.body.current.posts).toBeGreaterThanOrEqual(12);
    expect(insights.body.current.reach).toBeGreaterThan(0);
    expect(insights.body.followers.total).toBeGreaterThan(0);
    expect(insights.body.series.length).toBeGreaterThan(20);
    expect(insights.body.bestTimes.source).toBe("own");
    expect(insights.body.topPosts).toHaveLength(5);
    expect(insights.body.recommendations.length).toBeGreaterThan(0);
    expect(insights.body.comments.total).toBeGreaterThan(0);

    const times = await api("GET", `/accounts/${ig.id}/best-times`);
    expect(times.body.heatmap).toHaveLength(7);

    await api("PUT", `/accounts/${ig.id}`, { modes: { tip: "auto" } });
    await api("POST", "/posts", {
      accountId: ig.id,
      format: "image",
      caption: "Spring offer #reported",
      media: [{ url: "https://cdn.example.com/offer.jpg" }],
      when: "now",
    });
    const auto = await db
      .insert(socialAutoposts)
      .values({
        workspaceId: (await workspaceOf())!,
        accountId: ig.id as string,
        platform: "instagram",
        format: "image",
        contentType: "tip",
        caption: "Auto tip",
        media: [
          {
            url: "https://cdn.example.com/tip.jpg",
            kind: "image",
            creativeId: null,
            width: null,
            height: null,
            durationSeconds: null,
          },
        ],
        status: "scheduled",
        mode: "auto",
        scheduledAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const account = (
      await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, ig.id as string))
    )[0]!;
    await app.get(SocialInsightsService).syncMetrics(account);
    const paused = (await api("GET", `/accounts/${ig.id}`)).body;
    expect(paused.pauseReason).toContain("reported");
    expect((await api("GET", `/posts/${auto[0]!.id}`)).body).toMatchObject({
      status: "pending_approval",
      heldReason: expect.stringContaining("Safety pause"),
    });
    const resumed = await api("POST", `/accounts/${ig.id}/resume`);
    expect(resumed.body.pausedUntil).toBeNull();
  });

  it("marks an account for reconnection when the token is revoked", async () => {
    await db
      .update(socialAccounts)
      .set({ tokenCiphertext: app.get(CryptoService).encrypt("mock-revoked") })
      .where(eq(socialAccounts.id, fb.id as string));
    const res = await api("POST", `/accounts/${fb.id}/sync`);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const after = (await api("GET", `/accounts/${fb.id}`)).body;
    expect(after.status).toBe("error");
    expect(after.error).toContain("Connect again");
    expect((await api("DELETE", `/accounts/${fb.id}`)).statusCode).toBe(204);
    expect(
      (await api("GET", "/accounts?platform=facebook")).body.data,
    ).toHaveLength(1);
  });

  async function workspaceOf(): Promise<string> {
    const me = await call(app, "GET", "/api/v1/me", { headers: owner });
    return (me.body.workspace as Json).id as string;
  }
});
