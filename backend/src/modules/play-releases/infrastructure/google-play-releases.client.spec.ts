import {
  PlayApiError,
  ServiceAccountKey,
} from "@modules/play/domain/ports/play-api";

import {
  GooglePlayReleasesClient,
  fromRelease,
  toRelease,
  toVitalsRows,
} from "./google-play-releases.client";

const key: ServiceAccountKey = {
  clientEmail: "autopilot@acme-play.iam.gserviceaccount.com",
  privateKey: "unused",
  projectId: "acme-play",
  tokenUri: "https://oauth2.googleapis.com/token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const auth = {
  token: async (_k: ServiceAccountKey, scope: string) =>
    `t:${scope.split("/").pop()}`,
};

function fake(
  handler: (method: string, url: string, body: unknown) => Response,
) {
  const calls: { method: string; url: string; body: unknown; auth: string }[] =
    [];
  const http = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({
      method,
      url,
      body,
      auth: (init.headers as Record<string, string>).authorization!,
    });
    return handler(method, url, body);
  }) as typeof fetch;
  return { calls, client: new GooglePlayReleasesClient(auth, http) };
}

describe("GooglePlayReleasesClient", () => {
  it("never opens two edits for the same app at once", async () => {
    let open = 0;
    let next = 0;
    const { calls, client } = fake((method, url) => {
      if (method === "POST" && url.endsWith("/edits")) {
        if (open)
          return json(
            { error: { message: "This Edit has been deleted." } },
            400,
          );
        open++;
        return json({ id: `e${++next}` });
      }
      if (method === "DELETE") {
        open--;
        return json({});
      }
      if (url.endsWith("/tracks"))
        return json({ tracks: [{ track: "production", releases: [] }] });
      return json({ listings: [{ language: "en-US" }, { language: "hi-IN" }] });
    });
    const [tracks, languages] = await Promise.all([
      client.listTracks(key, "com.acme.shop"),
      client.listingLanguages(key, "com.acme.shop"),
    ]);
    expect(tracks).toEqual([{ track: "production", releases: [] }]);
    expect(languages).toEqual(["en-US", "hi-IN"]);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(2);
  });

  it("writes a track through edits.insert, tracks.update and edits.commit", async () => {
    const { calls, client } = fake((method, url, body) => {
      if (method === "POST" && url.endsWith("/edits"))
        return json({ id: "e1" });
      if (method === "PUT") return json(body);
      return json({});
    });
    const out = await client.updateTrack(key, "com.acme.shop", {
      track: "production",
      releases: [
        {
          name: "2.4.0",
          versionCodes: ["240"],
          status: "halted",
          userFraction: 0.1,
          releaseNotes: [],
        },
      ],
    });
    expect(
      calls.map((c) => `${c.method} ${c.url.split("/applications/")[1]}`),
    ).toEqual([
      "POST com.acme.shop/edits",
      "PUT com.acme.shop/edits/e1/tracks/production",
      "POST com.acme.shop/edits/e1:commit",
    ]);
    expect(calls[1]!.body).toEqual({
      track: "production",
      releases: [
        {
          name: "2.4.0",
          versionCodes: ["240"],
          status: "halted",
          userFraction: 0.1,
        },
      ],
    });
    expect(calls[0]!.auth).toBe("Bearer t:androidpublisher");
    expect(out.releases[0]).toMatchObject({
      status: "halted",
      userFraction: 0.1,
    });
  });

  it("deletes the edit and explains missing release permissions", async () => {
    const { calls, client } = fake((method, url) => {
      if (method === "POST" && url.endsWith("/edits"))
        return json({ id: "e2" });
      if (method === "PUT") return json({ error: { message: "denied" } }, 403);
      return json({});
    });
    const err = await client
      .updateTrack(key, "com.acme.shop", { track: "beta", releases: [] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PlayApiError);
    expect((err as PlayApiError).message).toContain(
      "Release apps to testing tracks",
    );
    expect(calls.at(-1)).toMatchObject({ method: "DELETE" });
    expect(calls.some((c) => c.url.endsWith(":commit"))).toBe(false);
  });

  it("reads tracks without committing", async () => {
    const { calls, client } = fake((method, url) => {
      if (method === "POST") return json({ id: "e3" });
      if (url.endsWith("/tracks"))
        return json({
          tracks: [
            {
              track: "production",
              releases: [{ versionCodes: ["231"], status: "completed" }],
            },
          ],
        });
      return json({});
    });
    const tracks = await client.listTracks(key, "com.acme.shop");
    expect(tracks).toEqual([
      {
        track: "production",
        releases: [
          {
            name: null,
            versionCodes: ["231"],
            status: "completed",
            userFraction: null,
            releaseNotes: [],
          },
        ],
      },
    ]);
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "DELETE"]);
  });

  it("queries daily vitals by version code from the freshest day", async () => {
    const { calls, client } = fake((method) =>
      method === "GET"
        ? json({
            freshnessInfo: {
              freshnesses: [
                {
                  aggregationPeriod: "DAILY",
                  latestEndTime: { year: 2026, month: 10, day: 16 },
                },
              ],
            },
          })
        : json({
            rows: [
              {
                startTime: { year: 2026, month: 10, day: 15 },
                dimensions: [{ dimension: "versionCode", int64Value: "240" }],
                metrics: [
                  {
                    metric: "userPerceivedCrashRate",
                    decimalValue: { value: "0.0231" },
                  },
                  { metric: "distinctUsers", decimalValue: { value: "900" } },
                ],
              },
            ],
          }),
    );
    const rows = await client.vitals(key, "com.acme.shop", "crash", 7);
    expect(rows).toEqual([
      { day: "2026-10-15", versionCode: "240", rate: 0.0231, users: 900 },
    ]);
    expect(calls[1]!.url).toContain(
      "/apps/com.acme.shop/crashRateMetricSet:query",
    );
    expect(calls[1]!.auth).toBe("Bearer t:playdeveloperreporting");
    expect(calls[1]!.body).toMatchObject({
      timelineSpec: {
        aggregationPeriod: "DAILY",
        startTime: { year: 2026, month: 10, day: 9 },
        endTime: { year: 2026, month: 10, day: 16 },
      },
      dimensions: ["versionCode"],
      metrics: ["userPerceivedCrashRate", "distinctUsers"],
    });
  });

  it("explains missing vitals permission", async () => {
    const { client } = fake(() => json({ error: { message: "nope" } }, 403));
    await expect(
      client.errorIssues(key, "com.acme.shop", "CRASH"),
    ).rejects.toThrow("View app quality information");
  });

  it("maps releases both ways", () => {
    expect(toRelease({ status: "statusUnspecified" }).status).toBe("draft");
    expect(
      fromRelease({
        name: null,
        versionCodes: ["1"],
        status: "completed",
        userFraction: 0.5,
        releaseNotes: [{ language: "en-US", text: "Hi" }],
      }),
    ).toEqual({
      versionCodes: ["1"],
      status: "completed",
      releaseNotes: [{ language: "en-US", text: "Hi" }],
    });
    expect(toVitalsRows([{ metrics: [] }], "x")).toEqual([]);
  });
});
