import { createVerify, generateKeyPairSync } from "crypto";

import { PlayApiError, ServiceAccountKey } from "../domain/ports/play-api";
import { parseServiceAccount } from "../domain/service-account";
import { GooglePlayClient, toReview } from "./google-play.client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const key: ServiceAccountKey = {
  clientEmail: "autopilot@acme-play.iam.gserviceaccount.com",
  privateKey: pem,
  projectId: "acme-play",
  tokenUri: "https://oauth2.googleapis.com/token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const apiReview = (
  id: string,
  stars: number,
  extra: Record<string, unknown> = {},
) => ({
  reviewId: id,
  authorName: "Priya Sharma",
  comments: [
    {
      userComment: {
        text: "\tGreat app ",
        lastModified: { seconds: "1792140000", nanos: 500_000_000 },
        starRating: stars,
        reviewerLanguage: "en",
        appVersionName: "2.3.1",
        appVersionCode: 231,
        androidOsVersion: 34,
        thumbsUpCount: 3,
        deviceMetadata: { manufacturer: "Samsung", productName: "a05m" },
        ...extra,
      },
    },
  ],
});

describe("parseServiceAccount", () => {
  it("accepts a service account key and explains wrong files", () => {
    const raw = JSON.stringify({
      type: "service_account",
      project_id: "acme-play",
      private_key: pem,
      client_email: key.clientEmail,
    });
    expect(parseServiceAccount(raw)).toEqual(key);
    expect(parseServiceAccount("{nope")).toContain("Paste the whole JSON key");
    expect(
      parseServiceAccount(JSON.stringify({ type: "authorized_user" })),
    ).toContain("not a service account");
    expect(
      parseServiceAccount(
        JSON.stringify({
          type: "service_account",
          client_email: "x@gmail.com",
        }),
      ),
    ).toBe("The key has no valid client_email.");
  });
});

describe("toReview", () => {
  it("maps Google's review shape", () => {
    const review = toReview({
      ...apiReview("r1", 5, { originalText: "बहुत अच्छा" }),
      comments: [
        ...apiReview("r1", 5, { originalText: "बहुत अच्छा" }).comments,
        {
          developerComment: {
            text: "Thanks!",
            lastModified: { seconds: "1792150000" },
          },
        },
      ],
    } as never);
    expect(review).toEqual({
      reviewId: "r1",
      authorName: "Priya Sharma",
      stars: 5,
      text: "Great app",
      originalText: "बहुत अच्छा",
      language: "en",
      lastModified: new Date(1792140000500),
      appVersionName: "2.3.1",
      appVersionCode: 231,
      device: "Samsung a05m",
      androidVersion: 34,
      thumbsUp: 3,
      reply: { text: "Thanks!", lastModified: new Date(1792150000000) },
    });
  });
});

describe("GooglePlayClient", () => {
  it("signs a token request, pages through reviews and caches the token", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const http = vi.fn(async (url: string, init?: RequestInit) => {
      const u = url;
      calls.push({ url: u, init });
      if (u === key.tokenUri)
        return json({ access_token: "ya29.token", expires_in: 3600 });
      if (u.includes("token=page2"))
        return json({ reviews: [apiReview("r3", 1)] });
      return json({
        reviews: [
          apiReview("r1", 5),
          apiReview("r2", 4),
          { reviewId: "x", comments: [] },
        ],
        tokenPagination: { nextPageToken: "page2" },
      });
    });
    const client = new GooglePlayClient(http as unknown as typeof fetch);
    const reviews = await client.listReviews(key, "com.acme.shop", {
      translationLanguage: "en",
    });
    expect(reviews.map((r) => r.reviewId)).toEqual(["r1", "r2", "r3"]);

    const assertion = new URLSearchParams(
      calls[0]!.init!.body as URLSearchParams,
    ).get("assertion")!;
    const [header, claims, signature] = assertion.split(".");
    expect(
      JSON.parse(Buffer.from(claims!, "base64url").toString()),
    ).toMatchObject({
      iss: key.clientEmail,
      aud: key.tokenUri,
      scope: "https://www.googleapis.com/auth/androidpublisher",
    });
    expect(
      createVerify("RSA-SHA256")
        .update(`${header}.${claims}`)
        .verify(publicKey, Buffer.from(signature!, "base64url")),
    ).toBe(true);
    expect(calls[1]!.url).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.acme.shop/reviews?maxResults=100&translationLanguage=en",
    );
    expect(
      (calls[1]!.init!.headers as Record<string, string>).authorization,
    ).toBe("Bearer ya29.token");

    await client.listReviews(key, "com.acme.shop", {});
    expect(calls.filter((c) => c.url === key.tokenUri)).toHaveLength(1);
  });

  it("posts replies and turns Google errors into clear messages", async () => {
    const http = vi.fn(async (url: string, init?: RequestInit) => {
      const u = url;
      if (u === key.tokenUri)
        return json({ access_token: "t", expires_in: 3600 });
      if (u.includes(":reply"))
        return json({
          result: {
            replyText: JSON.parse(init!.body as string).replyText,
            lastEdited: { seconds: "1792150000" },
          },
        });
      if (u.includes("com.acme.denied"))
        return json({ error: { message: "forbidden" } }, 403);
      if (u.includes("com.acme.busy"))
        return json({ error: { message: "quota" } }, 429);
      return json({}, 404);
    });
    const client = new GooglePlayClient(http as unknown as typeof fetch);
    await expect(
      client.reply(key, "com.acme.shop", "r1", "Thanks!"),
    ).resolves.toEqual({
      text: "Thanks!",
      lastModified: new Date(1792150000000),
    });
    await expect(
      client.listReviews(key, "com.acme.denied", {}),
    ).rejects.toThrow('give it "Reply to reviews" for this app');
    const busy = await client
      .listReviews(key, "com.acme.busy", {})
      .catch((e: PlayApiError) => e);
    expect(busy).toBeInstanceOf(PlayApiError);
    expect((busy as PlayApiError).kind).toBe("quota");
    await expect(
      client.listReviews(key, "com.acme.nothing", {}),
    ).rejects.toThrow("isn't in this Play Console account");
  });

  it("rejects a key Google refuses", async () => {
    const http = vi.fn(async () =>
      json(
        { error: "invalid_grant", error_description: "Invalid JWT Signature." },
        400,
      ),
    );
    const client = new GooglePlayClient(http as unknown as typeof fetch);
    await expect(client.verifyKey(key)).rejects.toThrow(
      "Google rejected this key: Invalid JWT Signature.",
    );
  });

  it("reads the store listing title and icon and always closes the edit", async () => {
    const seen: string[] = [];
    const http = vi.fn(async (url: string, init?: RequestInit) => {
      const u = url;
      seen.push(
        `${init?.method ?? "GET"} ${u.replace(/^.*applications\//, "")}`,
      );
      if (u === key.tokenUri)
        return json({ access_token: "t", expires_in: 3600 });
      if (u.endsWith("/edits")) return json({ id: "e1" });
      if (u.endsWith("/edits/e1/details"))
        return json({ defaultLanguage: "en-IN" });
      if (u.endsWith("/listings/en-IN")) return json({ title: "Acme Shop" });
      if (u.endsWith("/listings/en-IN/icon"))
        return json({
          images: [{ url: "https://lh3.googleusercontent.com/icon" }],
        });
      return new Response(null, { status: 204 });
    });
    const client = new GooglePlayClient(http as unknown as typeof fetch);
    await expect(client.listing(key, "com.acme.shop")).resolves.toEqual({
      title: "Acme Shop",
      iconUrl: "https://lh3.googleusercontent.com/icon",
    });
    expect(seen).toContain("DELETE com.acme.shop/edits/e1");
  });
});
