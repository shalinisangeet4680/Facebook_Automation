import { Resvg } from "@resvg/resvg-js";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { resetMockProfile } from "@modules/meta/infrastructure/mock-meta.profile";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call, multipart } from "./helpers";

const PHONE = "9000000012";
const E164 = `+91${PHONE}`;

describe("Profile setup", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let headers: Record<string, string>;

  async function upload(
    width: number,
    height: number,
    name: string,
  ): Promise<string> {
    const png = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#0c4a41"/></svg>`,
    )
      .render()
      .asPng();
    const body = multipart(png, "image/png", `${name}.png`, name);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/creatives",
      headers: { ...headers, "content-type": body.contentType },
      payload: body.payload,
    });
    return (JSON.parse(res.body) as { id: string }).id;
  }

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    resetMockProfile();
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
    headers = {
      "x-client": "mobile",
      authorization: `Bearer ${signIn.body.accessToken as string}`,
    };
    await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token: `EAA${"f".repeat(40)}` },
    });
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

  it("checks what's missing on the Page and Instagram", async () => {
    const res = await call(app, "GET", "/api/v1/profile", { headers });
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      facebook: { score: number; checks: { key: string; status: string }[] };
      instagram: { score: number; profile: { username: string } };
    };
    expect(body.facebook.score).toBe(0);
    expect(body.facebook.checks.map((c) => c.status)).toEqual([
      "missing",
      "missing",
      "missing",
      "missing",
      "missing",
    ]);
    expect(body.instagram.profile.username).toBe("arogyasystem");
    expect(body.instagram.score).toBeLessThan(100);
  });

  it("validates and saves a draft with images from the library", async () => {
    const bad = await call(app, "PUT", "/api/v1/profile/draft", {
      headers,
      body: { facebook: { email: "nope" } },
    });
    expect(bad.statusCode).toBe(400);
    const tooLong = await call(app, "PUT", "/api/v1/profile/draft", {
      headers,
      body: { instagram: { bio: "x".repeat(151) } },
    });
    expect(tooLong.statusCode).toBe(400);

    const logo = await upload(720, 720, "logo");
    const cover = await upload(1640, 624, "cover");
    const saved = await call(app, "PUT", "/api/v1/profile/draft", {
      headers,
      body: {
        facebook: {
          about:
            "Clinic management software for Indian doctors: appointments, prescriptions, billing and WhatsApp reminders.",
          website: "https://arogyasystem.com",
          phone: "+91 84342 30999",
          pictureCreativeId: logo,
          coverCreativeId: cover,
        },
        instagram: {
          bio: "One app for your whole clinic 🩺 Appointments · Prescriptions · Billing. Free demo 👇",
          pictureCreativeId: logo,
        },
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(
      (saved.body.facebook as { cover: { name: string } }).cover.name,
    ).toBe("cover");
  });

  it("applies the draft to the Facebook Page and rechecks", async () => {
    const res = await call(app, "POST", "/api/v1/profile/facebook/apply", {
      headers,
      body: {
        parts: ["about", "website", "phone", "picture", "cover", "email"],
      },
    });
    expect(res.statusCode).toBe(200);
    const results = res.body.results as {
      part: string;
      ok: boolean;
      error: string | null;
    }[];
    expect(
      results
        .filter((r) => r.ok)
        .map((r) => r.part)
        .sort(),
    ).toEqual(["about", "cover", "phone", "picture", "website"]);
    expect(results.find((r) => r.part === "email")).toMatchObject({
      ok: false,
      error: "Nothing drafted for this field.",
    });
    const checkup = res.body.checkup as { facebook: { score: number } };
    expect(checkup.facebook.score).toBe(100);
    const audit = await call(app, "GET", "/api/v1/audit-events?limit=5", {
      headers,
    });
    expect((audit.body.data as { action: string }[])[0]?.action).toBe(
      "profile.facebook_applied",
    );
  });
});
