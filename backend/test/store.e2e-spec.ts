import { Resvg } from "@resvg/resvg-js";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { StoreService } from "@modules/store/application/store.service";
import { storeProjects } from "@modules/store/infrastructure/store.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call, multipartFields } from "./helpers";

const OWNER = "9000000013";
const OTHER = "9000000014";

function png(width: number, height: number, fill = "#1b2536"): Buffer {
  return new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`,
  )
    .render()
    .asPng();
}

describe("Store listing", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: {
    headers: Record<string, string>;
    userId: string;
    workspaceId: string;
  };
  let other: {
    headers: Record<string, string>;
    userId: string;
    workspaceId: string;
  };

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
    const headers = {
      "x-client": "mobile",
      authorization: `Bearer ${res.body.accessToken as string}`,
    };
    const me = await call(app, "GET", "/api/v1/me", { headers });
    return {
      headers,
      userId: (me.body.user as { id: string }).id,
      workspaceId: (me.body.workspace as { id: string }).id,
    };
  }

  const upload = (
    token: string | undefined,
    fields: Record<string, string>,
    image: Buffer = png(1080, 1920),
    mime = "image/png",
  ) => {
    const body = multipartFields(image, mime, `${fields.name}.png`, fields);
    return app.inject({
      method: "POST",
      url: "/api/v1/store-uploads",
      headers: {
        "content-type": body.contentType,
        ...(token ? { "x-upload-token": token } : {}),
      },
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

  const save = (name: string, languages = ["en", "hi"]) =>
    app
      .get(StoreService)
      .save(
        { userId: owner.userId, workspaceId: owner.workspaceId, via: "test" },
        { name, languages },
      );

  it("takes the plugin's uploads, lets the owner choose a style and returns the set", async () => {
    const saved = await save("Acme Shop");
    expect(saved.uploadToken).toMatch(/^stu_/);

    const screen = await upload(
      saved.uploadToken,
      {
        kind: "screen",
        name: "home",
      },
      png(1080, 2400),
    );
    expect(screen.statusCode).toBe(201);
    expect(screen.json()).toMatchObject({
      kind: "screen",
      name: "home",
      width: 1080,
      height: 2400,
    });

    for (const style of ["callouts", "bold"])
      expect(
        (
          await upload(saved.uploadToken, {
            kind: "preview",
            name: "01_home",
            style,
            lang: "en",
            size: "phone",
          })
        ).statusCode,
      ).toBe(201);

    const list = await call(app, "GET", "/api/v1/store-projects", {
      headers: owner.headers,
    });
    const summary = (list.body.data as Record<string, any>[]).find(
      (p) => p.id === saved.projectId,
    );
    expect(summary).toMatchObject({
      name: "Acme Shop",
      slug: "acme-shop",
      status: "choosing",
      languages: ["en", "hi"],
      counts: { screens: 1, previews: 2, screenshots: 0, featureGraphics: 0 },
    });
    expect(summary!.coverUrl).toMatch(/\/media\//);

    const chosen = await call(
      app,
      "PUT",
      `/api/v1/store-projects/${saved.projectId}/choice`,
      {
        headers: owner.headers,
        body: {
          style: "bold",
          languages: ["en"],
          sizes: ["phone", "tablet10"],
        },
      },
    );
    expect(chosen.statusCode).toBe(200);
    expect(chosen.body).toMatchObject({
      status: "style_chosen",
      choice: {
        style: "bold",
        languages: ["en"],
        sizes: ["phone", "tablet10"],
      },
    });

    const first = await upload(saved.uploadToken, {
      kind: "screenshot",
      name: "01_home",
      style: "bold",
      lang: "en",
      size: "phone",
    });
    const replaced = await upload(
      saved.uploadToken,
      {
        kind: "screenshot",
        name: "01_home",
        style: "bold",
        lang: "en",
        size: "phone",
      },
      png(1080, 1920, "#4cc46a"),
    );
    expect(replaced.statusCode).toBe(201);
    expect(replaced.json().id).not.toBe(first.json().id);
    const oldImage = await app.inject({
      method: "GET",
      url: new URL(first.json().url as string).pathname,
    });
    expect(oldImage.statusCode).toBe(404);

    const feature = await upload(
      saved.uploadToken,
      { kind: "feature_graphic", name: "feature", style: "dark" },
      png(1024, 500),
    );
    expect(feature.statusCode).toBe(201);

    const detail = await call(
      app,
      "GET",
      `/api/v1/store-projects/${saved.projectId}`,
      { headers: owner.headers },
    );
    expect(detail.body.status).toBe("rendered");
    const assets = detail.body.assets as Record<string, any>[];
    expect(
      assets.map((a) => a.kind as string).sort((x, y) => x.localeCompare(y)),
    ).toEqual([
      "feature_graphic",
      "preview",
      "preview",
      "screen",
      "screenshot",
    ]);
    expect(detail.body.options).toMatchObject({
      styles: ["callouts", "light", "bold", "minimal"],
      sizes: ["phone", "tablet7", "tablet10"],
    });

    const shot = assets.find((a) => a.kind === "screenshot")!;
    const graphic = assets.find((a) => a.kind === "feature_graphic")!;
    const added = await call(
      app,
      "POST",
      `/api/v1/store-projects/${saved.projectId}/creatives`,
      { headers: owner.headers, body: { assetIds: [shot.id, graphic.id] } },
    );
    expect(added.statusCode).toBe(201);
    expect(
      (added.body.data as { name: string }[]).map((c) => c.name).sort(),
    ).toEqual([
      "Acme Shop · 01_home (bold, en, phone)",
      "Acme Shop · feature (dark)",
    ]);
    const creatives = await call(app, "GET", "/api/v1/creatives", {
      headers: owner.headers,
    });
    expect((creatives.body.data as unknown[]).length).toBe(2);

    const preview = assets.find((a) => a.kind === "preview")!;
    const refused = await call(
      app,
      "POST",
      `/api/v1/store-projects/${saved.projectId}/creatives`,
      { headers: owner.headers, body: { assetIds: [preview.id] } },
    );
    expect(refused.statusCode).toBe(400);
  });

  it("rejects bad tokens, wrong fields and non-images", async () => {
    const saved = await save("Token Test");
    expect(
      (await upload(undefined, { kind: "screen", name: "a" })).statusCode,
    ).toBe(401);
    expect(
      (await upload("stu_nope", { kind: "screen", name: "a" })).statusCode,
    ).toBe(401);

    const bad = await upload(saved.uploadToken, {
      kind: "screenshot",
      name: "01_home",
      style: "fancy",
      lang: "en",
      size: "phone",
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toContain("style must be one of");

    const notImage = await upload(
      saved.uploadToken,
      { kind: "screen", name: "home" },
      Buffer.from("not an image"),
    );
    expect(notImage.statusCode).toBe(400);

    await db
      .update(storeProjects)
      .set({ uploadTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(storeProjects.id, saved.projectId));
    const expired = await upload(saved.uploadToken, {
      kind: "screen",
      name: "home",
    });
    expect(expired.statusCode).toBe(401);
    expect(expired.json().message).toContain("expired");
  });

  it("starts a project from the app with an upload token", async () => {
    const created = await call(app, "POST", "/api/v1/store-projects", {
      headers: owner.headers,
      body: { name: "From App", languages: ["en"] },
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.uploadToken).toMatch(/^stu_/);
    expect(created.body.url).toBe(
      `http://localhost:3200/store/${created.body.projectId as string}`,
    );
    const invalid = await call(app, "POST", "/api/v1/store-projects", {
      headers: owner.headers,
      body: { name: "Bad", languages: ["english"] },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("validates the choice against the project", async () => {
    const saved = await save("Choice Test", ["en"]);
    const choose = (body: unknown) =>
      call(app, "PUT", `/api/v1/store-projects/${saved.projectId}/choice`, {
        headers: owner.headers,
        body,
      });
    expect(
      (await choose({ style: "fancy", languages: ["en"], sizes: ["phone"] }))
        .statusCode,
    ).toBe(400);
    const unknown = await choose({
      style: "light",
      languages: ["fr"],
      sizes: ["phone"],
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.body.message).toContain("fr");
    expect(
      (await choose({ style: "light", languages: ["en"], sizes: [] }))
        .statusCode,
    ).toBe(400);
  });

  it("keeps projects inside their workspace and deletes them with their images", async () => {
    const saved = await save("Delete Test");
    const shot = await upload(saved.uploadToken, {
      kind: "screen",
      name: "home",
    });
    const path = new URL(shot.json().url as string).pathname;

    const hidden = await call(
      app,
      "GET",
      `/api/v1/store-projects/${saved.projectId}`,
      {
        headers: other.headers,
      },
    );
    expect(hidden.statusCode).toBe(404);
    const theirs = await call(app, "GET", "/api/v1/store-projects", {
      headers: other.headers,
    });
    expect(theirs.body.data).toEqual([]);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/store-projects/${saved.projectId}`,
      headers: owner.headers,
    });
    expect(removed.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: path })).statusCode).toBe(
      404,
    );
    expect(
      (await upload(saved.uploadToken, { kind: "screen", name: "home" }))
        .statusCode,
    ).toBe(401);
  });
});
