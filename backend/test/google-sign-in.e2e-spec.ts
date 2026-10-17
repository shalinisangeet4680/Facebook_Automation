import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";

import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const EMAILS = ["google-owner@treevook.test", "second@example.com"];

describe("Sign in with Google", () => {
  let app: NestFastifyApplication;
  let db: Database;

  const start = async (next = "/reviews") => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/start?next=${encodeURIComponent(next)}&origin=http://localhost:3200`,
    });
    const state = res.cookies.find((c) => c.name === "tv_google_state");
    return {
      res,
      location: new URL(res.headers.location as string),
      nonce: state?.value,
    };
  };

  const cleanup = async () => {
    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.email, EMAILS));
    for (const user of rows) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  };

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it("signs up with Google, sets session cookies and returns to the page", async () => {
    const { res, location, nonce } = await start();
    expect(res.statusCode).toBe(302);
    expect(location.pathname).toBe("/api/v1/auth/google/callback");
    expect(nonce).toBeTruthy();

    const done = await app.inject({
      method: "GET",
      url: `${location.pathname}${location.search}`,
      cookies: { tv_google_state: nonce! },
    });
    expect(done.statusCode).toBe(302);
    expect(done.headers.location).toBe("http://localhost:3200/reviews");
    const access = done.cookies.find(
      (c) => c.name === "access_token" || c.name.includes("access"),
    );
    expect(access?.value).toBeTruthy();

    const me = await call(app, "GET", "/api/v1/me", {
      cookies: Object.fromEntries(done.cookies.map((c) => [c.name, c.value])),
    });
    expect(me.body).toMatchObject({
      user: { email: "google-owner@treevook.test", phone: null },
      workspace: { name: "My business", role: "owner" },
    });

    const again = await start("/business");
    const second = await app.inject({
      method: "GET",
      url: `${again.location.pathname}${again.location.search}`,
      cookies: { tv_google_state: again.nonce! },
    });
    expect(second.headers.location).toBe("http://localhost:3200/business");
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, "google-owner@treevook.test"));
    expect(rows).toHaveLength(1);
  });

  it("accepts the extra parameters Google adds to the callback", async () => {
    const { location, nonce } = await start("/home");
    const extra = new URLSearchParams({
      iss: "https://accounts.google.com",
      scope:
        "email profile https://www.googleapis.com/auth/userinfo.email openid",
      authuser: "0",
      prompt: "consent",
      hd: "treevook.test",
    });
    const res = await app.inject({
      method: "GET",
      url: `${location.pathname}${location.search}&${extra}`,
      cookies: { tv_google_state: nonce! },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("http://localhost:3200/home");
  });

  it("rejects a callback without the browser's state cookie", async () => {
    const { location } = await start();
    const res = await app.inject({
      method: "GET",
      url: `${location.pathname}${location.search}`,
    });
    expect(res.statusCode).toBe(302);
    const to = new URL(res.headers.location as string);
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("error")).toContain("expired");
    expect(res.cookies.some((c) => c.name.includes("access") && c.value)).toBe(
      false,
    );
  });

  it("sends cancelled sign-ins and unknown origins back safely", async () => {
    const cancelled = await app.inject({
      method: "GET",
      url: "/api/v1/auth/google/callback?error=access_denied",
    });
    expect(cancelled.headers.location).toContain(
      "/login?error=Google+sign-in+was+cancelled.",
    );

    const evil = await app.inject({
      method: "GET",
      url: "/api/v1/auth/google/start?origin=https://evil.example&next=//evil.example",
    });
    const url = new URL(evil.headers.location as string);
    expect(url.searchParams.get("code")).toBe("mock");
    expect(url.origin).toBe("http://localhost:3200");
  });
});
