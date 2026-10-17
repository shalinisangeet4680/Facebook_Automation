import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { BUSINESS_API } from "@modules/business/domain/ports/business-api";
import { MockBusinessApi } from "@modules/business/infrastructure/mock-business.api";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { DATABASE, Database } from "@shared/database/database";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000031";

type Json = Record<string, any>;

const DENTAL = {
  name: "categories/gcid:dental_clinic",
  displayName: "Dental clinic",
};
const HOURS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(
  (day) => ({ day, open: "10:00", close: "19:00" }),
);

const storefront = (title: string) => ({
  title,
  primaryCategory: DENTAL,
  additionalCategories: [
    { name: "categories/gcid:orthodontist", displayName: "Orthodontist" },
  ],
  phone: "+91 612 330 1234",
  website: "https://smilecare.example.in",
  description: "Gentle dental care for the whole family in Kankarbagh.",
  address: {
    lines: ["22 Main Road", "Kankarbagh"],
    locality: "Patna",
    region: "Bihar",
    postalCode: "800020",
    country: "IN",
  },
  hours: HOURS,
});

describe("Google Business: create and verify profiles", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let owner: Record<string, string>;
  let mock: MockBusinessApi;
  let created: Json;

  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{ statusCode: number; body: Json }> =>
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

  it("asks for a Google connection before searching or creating", async () => {
    const search = await api("POST", "/google/search", { query: "Gupta" });
    expect(search.statusCode).toBe(400);
    expect(search.body.message).toContain("Connect the Google account");

    const start = await api("POST", "/oauth/start", {
      origin: "http://localhost:3200",
    });
    const url = new URL(start.body.url as string);
    const done = await call(app, "GET", `${url.pathname}${url.search}`);
    expect(done.headers.location).toBe(
      "http://localhost:3200/business?connected=2",
    );
    const accounts = (await api("GET", "/accounts")).body.data as Json[];
    expect(accounts).toEqual([
      expect.objectContaining({
        account: "accounts/1001",
        name: "Sharma Dental Group",
        email: "owner@sharmadental.example.in",
      }),
    ]);
  });

  it("finds existing listings on Google with a claim link", async () => {
    const short = await api("POST", "/google/search", { query: "a" });
    expect(short.statusCode).toBe(400);

    const gupta = (await api("POST", "/google/search", { query: "Gupta" })).body
      .data as Json[];
    expect(
      gupta.map((m) => m.title as string).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["Gupta Medical Store", "Gupta Sweets Corner"]);
    expect(gupta[0]).toMatchObject({
      requestAdminRightsUri: expect.stringContaining(
        "https://business.google.com/arc/p/",
      ),
      locationId: null,
    });

    const byPhone = (
      await api("POST", "/google/search", {
        query: "store",
        phone: "0612 230 9988",
      })
    ).body.data as Json[];
    expect(byPhone.map((m) => m.title)).toContain("Gupta Medical Store");

    const ours = (await api("GET", "/locations")).body.data as Json[];
    const sharma = (
      await api("POST", "/google/search", { query: "Sharma Dental" })
    ).body.data as Json[];
    expect(sharma[0]!.locationId).toBe(
      ours.find((l) => l.title === "Sharma Dental Clinic")!.id,
    );

    const categories = (await api("GET", "/google/categories?q=dent")).body
      .data as Json[];
    expect(categories.map((c) => c.displayName)).toEqual(
      expect.arrayContaining(["Dental clinic", "Dentist", "Pediatric dentist"]),
    );
    expect(categories[0]!.name).toMatch(/^categories\/gcid:/);
  });

  it("validates a draft locally and with Google's dry run", async () => {
    const bad = await api("POST", "/profiles/validate", {
      business: {
        title: "Smile Care",
        primaryCategory: null,
        website: "http://smilecare.example.in",
        phone: "12",
        hours: [{ day: "MONDAY", open: "19:00", close: "10:00" }],
      },
    });
    expect(bad.statusCode).toBe(200);
    expect(bad.body.valid).toBe(false);
    expect(bad.body.problems).toEqual(
      expect.arrayContaining([
        "Choose a category from Google's list.",
        "The website must start with https://.",
        "The phone number looks too short.",
        "Add the address customers visit, or the areas you serve if you go to them.",
        "Monday closes before it opens; split overnight hours into two days.",
      ]),
    );

    const postal = await api("POST", "/profiles/validate", {
      business: {
        ...storefront("Smile Care"),
        address: { ...storefront("x").address, postalCode: "8000" },
      },
    });
    expect(postal.body.problems).toEqual([
      "The postal code doesn't look right.",
    ]);

    const rejected = await api("POST", "/profiles/validate", {
      business: storefront("Smile Care REJECT_ON_GOOGLE"),
    });
    expect(rejected.body).toMatchObject({
      valid: false,
      problems: [expect.stringContaining("invalid argument")],
    });

    const good = await api("POST", "/profiles/validate", {
      business: storefront("Smile Care Dental"),
    });
    expect(good.body.valid).toBe(true);
    expect(good.body.summary).toEqual(
      expect.arrayContaining([
        "Name: Smile Care Dental",
        "Category: Dental clinic, Orthodontist",
        "Address: 22 Main Road, Kankarbagh, Patna, Bihar, 800020",
        "Owner: Sharma Dental Group",
      ]),
    );
    expect(mock.created).toHaveLength(0);
  });

  it("creates a storefront profile once per request and imports it unverified", async () => {
    const requestId = randomUUID();
    const res = await api("POST", "/profiles", {
      business: storefront("Smile Care Dental"),
      requestId,
    });
    expect(res.statusCode).toBe(201);
    created = res.body;
    expect(created).toMatchObject({
      title: "Smile Care Dental",
      verified: false,
      verificationState: "unverified",
      createdInApp: true,
      category: "Dental clinic",
      address: "22 Main Road, Kankarbagh, Patna",
      mapsUri: null,
    });
    expect(created.settings.ratingRules).toHaveLength(5);
    expect(created.variables).toMatchObject({
      phone: "+91 612 330 1234",
      website: "https://smilecare.example.in",
    });

    const again = await api("POST", "/profiles", {
      business: storefront("Smile Care Dental"),
      requestId,
    });
    expect(again.body.id).toBe(created.id);
    expect(mock.created).toHaveLength(1);

    const list = (await api("GET", "/locations")).body.data as Json[];
    expect(list).toHaveLength(3);
    expect(list.find((l) => l.id === created.id)).toMatchObject({
      verified: false,
      verificationState: "unverified",
    });

    const invalid = await api("POST", "/profiles", {
      business: { ...storefront("Smile Care"), website: "smilecare.in" },
    });
    expect(invalid.statusCode).toBe(400);

    const sync = await api("POST", `/locations/${created.id as string}/sync`);
    expect(sync.statusCode).toBe(200);
    expect(sync.body.archived).toBe(false);
  });

  it("creates a service-area business without a storefront address", async () => {
    const res = await api("POST", "/profiles", {
      business: {
        title: "Patna Home Cleaning",
        primaryCategory: {
          name: "categories/gcid:house_cleaning_service",
          displayName: "House cleaning service",
        },
        phone: "+91 98765 43210",
        serviceArea: {
          regionCode: "IN",
          places: ["Kankarbagh", "Boring Road", " "],
        },
        hours: [],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      address: "Serves Kankarbagh, Boring Road",
      info: {
        address: null,
        serviceArea: {
          regionCode: "IN",
          places: ["Kankarbagh", "Boring Road"],
        },
      },
    });
    expect(mock.created.at(-1)?.business.serviceArea?.places).toEqual([
      "Kankarbagh",
      "Boring Road",
    ]);
    const status = (
      await api("GET", `/locations/${res.body.id as string}/verification`)
    ).body;
    expect(status).toMatchObject({
      state: "unverified",
      verified: false,
      needsCode: false,
    });
    const options = (
      await api(
        "GET",
        `/locations/${res.body.id as string}/verification/options`,
      )
    ).body.data as Json[];
    expect(options.map((o) => o.method)).toEqual(["SMS", "PHONE_CALL"]);
  });

  it("verifies a new profile with a code from Google", async () => {
    const id = created.id as string;
    const options = (await api("GET", `/locations/${id}/verification/options`))
      .body;
    expect(options.data.map((o: Json) => o.method)).toEqual([
      "SMS",
      "PHONE_CALL",
      "EMAIL",
      "ADDRESS",
    ]);
    expect(options.data[2]).toMatchObject({
      label: "Email",
      email: "owner@smilecare.example.in",
      emailEditable: true,
      needsCode: true,
    });

    const early = await api("POST", `/locations/${id}/verification/complete`, {
      code: "123456",
    });
    expect(early.statusCode).toBe(400);
    expect(early.body.message).toContain("Ask Google for a code first");

    const wrongDomain = await api("POST", `/locations/${id}/verification`, {
      method: "EMAIL",
      email: "me@gmail.com",
    });
    expect(wrongDomain.statusCode).toBe(400);
    expect(wrongDomain.body.message).toContain("smilecare.example.in");

    const unsupported = await api("POST", `/locations/${id}/verification`, {
      method: "AUTO",
    });
    expect(unsupported.statusCode).toBe(400);

    const started = await api("POST", `/locations/${id}/verification`, {
      method: "SMS",
    });
    expect(started.statusCode).toBe(200);
    expect(started.body).toMatchObject({
      state: "pending",
      method: "SMS",
      methodLabel: "Text message",
      target: "+91 612 330 1234",
      needsCode: true,
      verified: false,
      note: "Google texted a code to +91 612 330 1234. Enter it below.",
    });
    expect(mock.verifyRequests.at(-1)).toMatchObject({
      request: { method: "SMS", phone: "+91 612 330 1234" },
    });
    const pending = (await api("GET", `/locations/${id}`)).body;
    expect(pending).toMatchObject({
      verificationState: "pending",
      verificationMethod: "SMS",
    });

    const badFormat = await api(
      "POST",
      `/locations/${id}/verification/complete`,
      { code: "abc" },
    );
    expect(badFormat.statusCode).toBe(400);
    const wrong = await api("POST", `/locations/${id}/verification/complete`, {
      code: "000000",
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.body.message).toContain("That code didn't work");

    const done = await api("POST", `/locations/${id}/verification/complete`, {
      code: "123 456",
    });
    expect(done.statusCode).toBe(200);
    expect(done.body).toMatchObject({
      verified: true,
      state: "verified",
      needsCode: false,
    });
    const location = (await api("GET", `/locations/${id}`)).body;
    expect(location).toMatchObject({
      verified: true,
      verificationState: "verified",
      mapsUri: expect.stringContaining("ChIJmockNew"),
    });
    const again = await api("POST", `/locations/${id}/verification`, {
      method: "SMS",
    });
    expect(again.statusCode).toBe(400);

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=50", {
      headers: owner,
    });
    const actions = (audit.body.data as Json[]).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "business.location_created",
        "business.verification_started",
        "business.verification_code_rejected",
        "business.verified",
      ]),
    );
  });

  it("creates business groups and asks which account owns a new profile", async () => {
    const [connection] = (await api("GET", "/connections")).body.data as Json[];
    const group = await api("POST", "/accounts/groups", {
      connectionId: connection!.id,
      name: "Patna Clients",
    });
    expect(group.statusCode).toBe(201);
    expect(group.body).toMatchObject({
      name: "Patna Clients",
      type: "LOCATION_GROUP",
      account: expect.stringMatching(/^accounts\/\d+$/),
    });
    expect((await api("GET", "/accounts")).body.data).toHaveLength(2);

    const ambiguous = await api("POST", "/profiles", {
      business: storefront("Agency Client Dental"),
    });
    expect(ambiguous.statusCode).toBe(400);
    expect(ambiguous.body.details.accounts).toHaveLength(2);

    const inGroup = await api("POST", "/profiles", {
      business: storefront("Agency Client Dental"),
      connectionId: connection!.id,
      account: group.body.account,
    });
    expect(inGroup.statusCode).toBe(201);
    expect(mock.created.at(-1)?.account).toBe(group.body.account);

    const discovered = await api("POST", "/discover");
    expect(discovered.body).toMatchObject({ found: 5, added: [] });
  });
});
