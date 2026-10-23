import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { BusinessEngine } from "@modules/business/application/business-engine.service";
import { BUSINESS_API } from "@modules/business/domain/ports/business-api";
import { MockBusinessApi } from "@modules/business/infrastructure/mock-business.api";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000018";

type Json = Record<string, any>;

describe("Google Business automation", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let mock: MockBusinessApi;
  let main: Json;

  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{ statusCode: number; body: Json; headers: Json }> =>
    call(app, method, `/api/v1/business${url}`, { headers: owner, body });

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    mock = app.get<MockBusinessApi>(BUSINESS_API);
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

  it("connects with Google sign-in and imports every location with its reviews", async () => {
    expect((await api("GET", "/status")).body).toMatchObject({
      configured: true,
      mock: true,
      redirectUri: "http://localhost:3200/api/v1/business/oauth/callback",
    });
    expect((await api("GET", "/connections")).body.data).toEqual([]);

    const bad = await call(
      app,
      "GET",
      "/api/v1/business/oauth/callback?code=mock&state=forged",
    );
    expect(bad.statusCode).toBe(302);
    expect(bad.headers.location).toContain("/business/connect?error=");

    const elsewhere = await api("POST", "/oauth/start", {
      origin: "https://evil.example",
    });
    expect(new URL(elsewhere.body.url as string).searchParams.get("code")).toBe(
      "mock",
    );
    expect(elsewhere.body.url).toContain(
      "http://localhost:3200/api/v1/business/oauth/callback",
    );

    const start = await api("POST", "/oauth/start", {
      origin: "http://localhost:3200",
    });
    const url = new URL(start.body.url as string);
    expect(url.searchParams.get("code")).toBe("mock");
    const done = await call(app, "GET", `${url.pathname}${url.search}`);
    expect(done.statusCode).toBe(302);
    expect(done.headers.location).toBe(
      "http://localhost:3200/business?connected=2",
    );

    const connections = (await api("GET", "/connections")).body.data as Json[];
    expect(connections).toEqual([
      expect.objectContaining({
        email: "owner@sharmadental.example.in",
        status: "active",
        locations: 2,
      }),
    ]);

    const locations = (await api("GET", "/locations")).body.data as Json[];
    expect(locations).toHaveLength(2);
    main = locations.find((l) => l.title === "Sharma Dental Clinic")!;
    expect(main).toMatchObject({
      address: "12 Fraser Road, Patna",
      category: "Dental clinic",
      totalReviews: 18,
      mode: "approval",
      verified: true,
    });
    expect(main.rating).toBeGreaterThan(3);
    expect(main.needsReply).toBeGreaterThan(0);

    const detail = (await api("GET", `/locations/${main.id}`)).body;
    expect(detail.settings.ratingRules).toHaveLength(5);
    expect(detail.settings.ratingRules.every((r: Json) => r.templateId)).toBe(
      true,
    );
    expect(detail.variables).toMatchObject({
      phone: "+91 612 220 4455",
      website: "https://sharmadental.example.in",
    });

    const again = await api("POST", "/discover");
    expect(again.body).toMatchObject({
      found: 2,
      added: [],
      already: expect.any(Array),
    });
  });

  it("drafts replies on the first sync and posts approved ones to Google", async () => {
    const inbox = (await api("GET", `/inbox?locationId=${main.id}`)).body;
    expect(inbox.counts.pending).toBeGreaterThan(0);
    const waiting = (inbox.data as Json[]).filter((r) => r.state === "waiting");
    expect(waiting.length).toBeGreaterThan(0);
    const one = waiting.find((r) => r.stars <= 2)!;
    expect(one.draft).toMatchObject({
      status: "pending_approval",
      source: "ai",
    });

    const sent = await api("POST", `/replies/${one.draft.id}/approve`, {
      text: "Sorry about the wait, please call us so we can fix this.",
    });
    expect(sent.statusCode).toBe(200);
    expect(sent.body).toMatchObject({
      state: "replied",
      reply: {
        text: "Sorry about the wait, please call us so we can fix this.",
      },
    });
    expect(mock.replies.at(-1)).toMatchObject({
      text: "Sorry about the wait, please call us so we can fix this.",
    });

    const removed = await api("DELETE", `/reviews/${one.id}/reply`);
    expect(removed.body).toMatchObject({ reply: null });
    expect(
      mock.deletedReplies.some((n) => n.endsWith(`/${one.reviewId as string}`)),
    ).toBe(true);

    const failed = await api("POST", `/reviews/${one.id}/reply`, {
      text: "FAIL_ON_GOOGLE please",
    });
    expect(failed.statusCode).toBe(400);
    const after = (await api("GET", `/locations/${main.id}/reviews`)).body
      .data as Json[];
    expect(after.find((r) => r.id === one.id)).toMatchObject({
      state: "failed",
    });

    const five = await api("GET", `/locations/${main.id}/reviews?stars=5`);
    expect((five.body.data as Json[]).every((r) => r.stars === 5)).toBe(true);
    expect(
      (await api("GET", `/locations/${main.id}/reviews?stars=0`)).statusCode,
    ).toBe(400);
  });

  it("auto-replies to new reviews when the owner turns on auto for a rating", async () => {
    const detail = (await api("GET", `/locations/${main.id}`)).body;
    const rules = (detail.settings.ratingRules as Json[]).map((r) =>
      r.rating === 5 ? { ...r, mode: "auto" } : r,
    );
    const saved = await api("PUT", `/locations/${main.id}`, {
      ratingRules: rules,
      settings: { quietHours: null, personalize: false },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body.mode).toBe("mixed");

    mock.addReview("mock-refresh", "locations/5001", {
      reviewId: "fresh5",
      reviewer: "Meera Das",
      stars: 5,
      comment: "Wonderful staff and very clean.",
    });
    mock.addReview("mock-refresh", "locations/5001", {
      reviewId: "fresh1",
      reviewer: "Ravi Kumar",
      stars: 1,
      comment: "They want to sue me over the bill, lawyer involved.",
    });
    const sync = await api("POST", `/locations/${main.id}/sync`);
    expect(sync.body).toMatchObject({ created: 2, archived: false });

    const reviews = (await api("GET", `/locations/${main.id}/reviews`)).body
      .data as Json[];
    const happy = reviews.find((r) => r.reviewId === "fresh5")!;
    expect(happy).toMatchObject({
      state: "scheduled",
      topic: "Staff",
      draft: { auto: true, source: "template" },
    });
    expect(happy.draft.text).toContain("Meera");
    expect(happy.draft.text).toContain("Sharma Dental Clinic");
    const angry = reviews.find((r) => r.reviewId === "fresh1")!;
    expect(angry.state).toBe("waiting");

    const engine = app.get(BusinessEngine);
    await engine.repo.updateReply(happy.draft.id, {
      sendAt: new Date(Date.now() - 1000),
    });
    const result = await engine.sendDue();
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(mock.replies.some((r) => r.reviewName.endsWith("/fresh5"))).toBe(
      true,
    );
  });

  it("publishes, schedules and deletes posts", async () => {
    const now = await api("POST", "/posts", {
      locationId: main.id,
      when: "now",
      content: {
        type: "STANDARD",
        summary: "Free dental check-up camp this Sunday!",
        mediaUrl: null,
        cta: { type: "CALL", url: null },
        event: null,
        offer: null,
      },
    });
    expect(now.statusCode).toBe(201);
    expect(now.body).toMatchObject({
      status: "published",
      searchUrl: expect.any(String),
    });
    expect(mock.createdPosts.at(-1)?.post.summary).toBe(
      "Free dental check-up camp this Sunday!",
    );

    const missing = await api("POST", "/posts", {
      locationId: main.id,
      when: "now",
      content: {
        type: "OFFER",
        summary: "20% off whitening",
        mediaUrl: null,
        cta: { type: "BOOK", url: "http://insecure.example" },
        event: null,
        offer: { couponCode: "SMILE20", redeemUrl: null, terms: null },
      },
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.body.message).toContain("Give the offer a title.");
    expect(missing.body.message).toContain("https link");

    const at = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const scheduled = await api("POST", "/posts", {
      locationId: main.id,
      when: "schedule",
      scheduledAt: at,
      content: {
        type: "OFFER",
        summary: "20% off whitening this Diwali",
        mediaUrl: "https://cdn.example.in/diwali.jpg",
        cta: { type: "BOOK", url: "https://sharmadental.example.in/book" },
        event: {
          title: "Diwali smile offer",
          start: new Date().toISOString(),
          end: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        },
        offer: {
          couponCode: "SMILE20",
          redeemUrl: null,
          terms: "One per patient",
        },
      },
    });
    expect(scheduled.body).toMatchObject({
      status: "scheduled",
      scheduledAt: at,
    });

    const engine = app.get(BusinessEngine);
    await engine.repo.updatePost(scheduled.body.id as string, {
      scheduledAt: new Date(Date.now() - 1000),
    });
    expect(await engine.publishDue()).toMatchObject({ published: 1 });

    const posts = (await api("GET", `/posts?locationId=${main.id}`)).body
      .data as Json[];
    expect(posts.filter((p) => p.status === "published")).toHaveLength(2);

    expect(
      (await api("DELETE", `/posts/${now.body.id as string}`)).statusCode,
    ).toBe(204);
    expect(
      (await api("GET", `/posts?locationId=${main.id}`)).body.data,
    ).toHaveLength(1);
  });

  it("previews and updates the business profile", async () => {
    const preview = await api("POST", `/locations/${main.id}/info/preview`, {
      description: "Painless dentistry. Visit www.example.com",
      hours: [{ day: "MONDAY", open: "10:00", close: "09:00" }],
    });
    expect(preview.body.problems).toEqual([
      "Google doesn't allow links in the description.",
      "Monday closes before it opens; split overnight hours into two days.",
    ]);

    const updated = await api("PUT", `/locations/${main.id}/info`, {
      description: "Painless family dentistry in Patna since 2009.",
      phone: "+91 612 220 9999",
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.body.info).toMatchObject({
      description: "Painless family dentistry in Patna since 2009.",
      phone: "+91 612 220 9999",
    });
    expect(mock.updates.at(-1)?.patch).toEqual({
      description: "Painless family dentistry in Patna since 2009.",
      phone: "+91 612 220 9999",
    });
  });

  it("lists the business's photos with the logo and cover first", async () => {
    const res = await api("GET", `/locations/${main.id}/photos`);
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBeNull();
    const photos = res.body.photos as Json[];
    expect(photos.map((p) => p.category).slice(0, 2)).toEqual([
      "LOGO",
      "COVER",
    ]);
    expect(photos).toHaveLength(6);
    expect(photos[0]!.url).toMatch(/^data:image\/svg\+xml,/);
  });

  it("reports profile insights and review analytics", async () => {
    const insights = (
      await api("GET", `/insights?locationId=${main.id}&days=30`)
    ).body;
    expect(insights.series.length).toBeGreaterThanOrEqual(30);
    expect(insights.current.calls).toBeGreaterThan(0);
    expect(insights.current.impressionsSearch).toBeGreaterThan(
      insights.current.calls,
    );

    const all = (await api("GET", "/insights?days=7")).body;
    expect(all.current.impressionsMaps).toBeGreaterThan(0);

    const analytics = (
      await api("GET", `/analytics?locationId=${main.id}&all=true`)
    ).body;
    expect(analytics.current.reviews).toBeGreaterThanOrEqual(18);
    expect(analytics.repliesSent).toBeGreaterThanOrEqual(1);

    const dashboard = (await api("GET", "/dashboard")).body;
    expect(dashboard).toMatchObject({ locations: 2, scheduledPosts: 0 });
  });

  it("manages templates and keeps built-ins", async () => {
    const list = (await api("GET", "/templates")).body.data as Json[];
    expect(list.filter((t) => t.preset)).toHaveLength(4);
    const created = await api("POST", "/templates", {
      name: "Clinic follow-up",
      category: "neutral",
      ratings: [3],
      bodies: [
        {
          language: "en",
          variants: ["Hi {user_name}, thanks for visiting {business_name}."],
        },
      ],
    });
    expect(created.statusCode).toBe(201);
    const preset = list.find((t) => t.preset)!;
    expect(
      (await api("DELETE", `/templates/${preset.id as string}`)).statusCode,
    ).toBe(400);
    const hidden = await api(
      "PUT",
      `/templates/${preset.id as string}/visibility`,
      { hidden: true },
    );
    expect(hidden.body.hidden).toBe(true);
    expect(
      (await api("DELETE", `/templates/${created.body.id as string}`))
        .statusCode,
    ).toBe(204);
  });
});
