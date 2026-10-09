import { Resvg } from "@resvg/resvg-js";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call, multipart } from "./helpers";

const PHONE = "9000000006";
const E164 = `+91${PHONE}`;

function png(width: number, height: number): Buffer {
  return new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#4f46e5"/></svg>`,
  )
    .render()
    .asPng();
}

describe("Creatives", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let auth: Record<string, string>;

  const upload = (
    file: Buffer,
    mime: string,
    filename: string,
    name?: string,
  ) => {
    const body = multipart(file, mime, filename, name);
    return app.inject({
      method: "POST",
      url: "/api/v1/creatives",
      headers: { ...auth, "content-type": body.contentType },
      payload: body.payload,
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
    auth = {
      "x-client": "mobile",
      authorization: `Bearer ${signIn.body.accessToken as string}`,
    };
  });

  afterAll(async () => {
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

  it("uploads an image, serves it publicly and lists it", async () => {
    const res = await upload(
      png(1080, 1080),
      "image/png",
      "banner.png",
      "Diwali offer",
    );
    expect(res.statusCode).toBe(201);
    const creative = JSON.parse(res.body) as {
      id: string;
      url: string;
      width: number;
      name: string;
      source: string;
    };
    expect(creative).toMatchObject({
      width: 1080,
      name: "Diwali offer",
      source: "upload",
    });
    expect(creative.url).toMatch(
      /^http:\/\/localhost:3200\/media\/[0-9a-f-]+-[A-Za-z0-9_-]+\.png$/,
    );

    const image = await app.inject({
      method: "GET",
      url: new URL(creative.url).pathname,
    });
    expect(image.statusCode).toBe(200);
    expect(image.headers["cache-control"]).toContain("immutable");

    const list = await call(app, "GET", "/api/v1/creatives", { headers: auth });
    expect((list.body.data as { id: string }[])[0]!.id).toBe(creative.id);

    const del = await call(app, "DELETE", `/api/v1/creatives/${creative.id}`, {
      headers: auth,
    });
    expect(del.statusCode).toBe(204);
    const gone = await app.inject({
      method: "GET",
      url: new URL(creative.url).pathname,
    });
    expect(gone.statusCode).toBe(404);
  });

  it("rejects small, fake and unsupported files", async () => {
    const small = await upload(png(200, 200), "image/png", "tiny.png");
    expect(small.statusCode).toBe(400);
    expect(JSON.parse(small.body).message).toContain("at least 500");
    const fake = await upload(
      Buffer.from("not an image at all"),
      "image/png",
      "fake.png",
    );
    expect(fake.statusCode).toBe(400);
    const gif = await upload(png(600, 600), "image/gif", "anim.gif");
    expect(gif.statusCode).toBe(400);
  });

  it("does not serve paths outside the media folder", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/media/..%2F..%2Fpackage.json",
    });
    expect(res.statusCode).toBe(404);
  });
});
