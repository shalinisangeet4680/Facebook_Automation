import { Resvg } from "@resvg/resvg-js";
import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockPublishing } from "@modules/meta/infrastructure/mock-meta.publishing";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { WorkerModule } from "../src/worker.module";
import { call, multipart } from "./helpers";

const PHONE = "9000000010";
const E164 = `+91${PHONE}`;

interface Post {
  id: string;
  status: string;
  facebook: {
    postId: string | null;
    permalink: string | null;
    error: string | null;
  } | null;
  instagram: {
    mediaId: string | null;
    permalink: string | null;
    error: string | null;
  } | null;
}

describe("Social publishing", () => {
  let app: NestFastifyApplication;
  let worker: INestApplicationContext;
  let db: Database;
  let headers: Record<string, string>;
  let creativeId: string;

  async function waitFor(
    id: string,
    done: (p: Post) => boolean,
  ): Promise<Post> {
    for (let i = 0; i < 50; i++) {
      const list = await call(app, "GET", "/api/v1/posts", { headers });
      const post = (list.body.data as Post[]).find((p) => p.id === id)!;
      if (done(post)) return post;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Post did not finish");
  }

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = [
      ...(await redis.keys("throttle:*")),
      ...(await redis.keys("social:*")),
    ];
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    resetMockPublishing();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
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
    headers = {
      "x-client": "mobile",
      authorization: `Bearer ${signIn.body.accessToken as string}`,
    };
    await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: `EAA${"s".repeat(40)}` },
    });
    const png = new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#0c4a41"/></svg>',
    )
      .render()
      .asPng();
    const body = multipart(png, "image/png", "post.png", "Clinic banner");
    const uploaded = await app.inject({
      method: "POST",
      url: "/api/v1/creatives",
      headers: { ...headers, "content-type": body.contentType },
      payload: body.payload,
    });
    creativeId = (JSON.parse(uploaded.body) as { id: string }).id;
  });

  afterAll(async () => {
    await worker.close();
    const user = await db.query.users.findFirst({
      where: eq(users.phone, E164),
    });
    if (user) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await db.delete(otpChallenges).where(eq(otpChallenges.phone, E164));
    await app.close();
  });

  it("lists the channels to post to", async () => {
    const res = await call(app, "GET", "/api/v1/social/channels", { headers });
    expect(res.body).toMatchObject({
      facebook: { id: "1301000000000001", name: "Arogya System" },
      instagram: { id: "1781000000000001", username: "@arogyasystem" },
    });
  });

  it("validates captions and schedules", async () => {
    const noCaption = await call(app, "POST", "/api/v1/posts", {
      headers,
      body: { creativeId, platforms: ["instagram"], facebookCaption: "Hello" },
    });
    expect(noCaption.statusCode).toBe(400);
    expect(noCaption.body.message).toContain("Instagram caption");
    const tooSoon = await call(app, "POST", "/api/v1/posts", {
      headers,
      body: {
        creativeId,
        platforms: ["facebook"],
        facebookCaption: "Hi",
        scheduledAt: new Date(Date.now() + 30_000).toISOString(),
      },
    });
    expect(tooSoon.statusCode).toBe(400);
  });

  it("publishes now to Facebook and Instagram in the worker", async () => {
    const res = await call(app, "POST", "/api/v1/posts", {
      headers,
      body: {
        creativeId,
        platforms: ["facebook", "instagram"],
        facebookCaption:
          "Run your whole clinic from one app. Try the free demo.",
        instagramCaption: "One app for your whole clinic 🩺 #clinic #doctors",
      },
    });
    expect(res.statusCode).toBe(201);
    const post = await waitFor(
      res.body.id as string,
      (p) => !["scheduled", "publishing"].includes(p.status),
    );
    expect(post.status).toBe("published");
    expect(post.facebook?.postId).toMatch(/^1301000000000001_/);
    expect(post.instagram?.permalink).toContain("instagram.com");

    const library = await call(
      app,
      "GET",
      "/api/v1/social/library?platform=facebook",
      { headers },
    );
    expect((library.body.data as { id: string }[])[0]!.id).toBe(
      post.facebook?.postId,
    );
  });

  it("records a partial failure per platform", async () => {
    const res = await call(app, "POST", "/api/v1/posts", {
      headers,
      body: {
        creativeId,
        platforms: ["facebook", "instagram"],
        facebookCaption: "Works on Facebook",
        instagramCaption: "Breaks on Instagram #fail-instagram",
      },
    });
    const post = await waitFor(
      res.body.id as string,
      (p) => !["scheduled", "publishing"].includes(p.status),
    );
    expect(post.status).toBe("partially_published");
    expect(post.facebook?.postId).toBeTruthy();
    expect(post.instagram?.error).toContain("couldn't process");
  });

  it("schedules, blocks deleting the image, and cancels", async () => {
    const res = await call(app, "POST", "/api/v1/posts", {
      headers,
      body: {
        creativeId,
        platforms: ["facebook"],
        facebookCaption: "Diwali offer",
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    expect(res.body.status).toBe("scheduled");
    const id = res.body.id as string;
    const del = await call(app, "DELETE", `/api/v1/creatives/${creativeId}`, {
      headers,
    });
    expect(del.statusCode).toBe(400);
    const cancel = await call(app, "POST", `/api/v1/posts/${id}/cancel`, {
      headers,
    });
    expect(cancel.body.status).toBe("cancelled");
    const again = await call(app, "POST", `/api/v1/posts/${id}/cancel`, {
      headers,
    });
    expect(again.statusCode).toBe(409);
    const audit = await call(app, "GET", "/api/v1/audit-events?limit=50", {
      headers,
    });
    const actions = (audit.body.data as { action: string }[]).map(
      (e) => e.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "social.published",
        "social.partially_published",
        "social.scheduled",
        "social.cancelled",
      ]),
    );
  });
});
