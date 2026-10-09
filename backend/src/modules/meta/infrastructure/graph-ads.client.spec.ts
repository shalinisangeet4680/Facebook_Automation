import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { GraphAdsClient } from "./graph-ads.client";

class TestClient extends GraphAdsClient {
  protected override wait(): Promise<void> {
    return Promise.resolve();
  }
}

const config = { get: () => "v23.0" } as unknown as ConfigService<Env, true>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const draft = {
  adAccountId: "act_1",
  name: "Test",
  objective: "OUTCOME_TRAFFIC",
  dailyBudget: 50_000,
  adSet: {
    optimizationGoal: "LANDING_PAGE_VIEWS",
    billingEvent: "IMPRESSIONS",
    destinationType: "WEBSITE",
    promotedObject: null,
    targeting: { geo_locations: { countries: ["IN"] } },
  },
  creative: {
    pageId: "p1",
    instagramId: null,
    message: "Hello",
    headline: "Head",
    description: null,
    link: "https://example.com/",
    imageUrl: "https://example.com/a.png",
    imageHash: null,
    callToAction: "LEARN_MORE",
  },
};

describe("GraphAdsClient", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const client = new TestClient(config);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterAll(() => vi.unstubAllGlobals());

  it("creates every object paused with form-encoded JSON fields", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "c1" }))
      .mockResolvedValueOnce(json({ id: "s1" }))
      .mockResolvedValueOnce(json({ id: "cr1" }))
      .mockResolvedValueOnce(json({ id: "a1" }));
    const result = await client.createDraft("tok", draft);
    expect(result).toEqual({
      campaignId: "c1",
      adSetId: "s1",
      creativeId: "cr1",
      adId: "a1",
    });
    const bodies = fetchMock.mock.calls.map(
      ([, init]) => init?.body as URLSearchParams,
    );
    expect(bodies[0]!.get("status")).toBe("PAUSED");
    expect(bodies[1]!.get("status")).toBe("PAUSED");
    expect(JSON.parse(bodies[1]!.get("targeting")!)).toEqual(
      draft.adSet.targeting,
    );
    expect(
      JSON.parse(bodies[2]!.get("object_story_spec")!).link_data.picture,
    ).toBe(draft.creative.imageUrl);
    expect(bodies[3]!.get("status")).toBe("PAUSED");
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method === "POST"),
    ).toBe(true);
  });

  it("surfaces Meta's message and removes the half-built campaign", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "c1" }))
      .mockResolvedValueOnce(
        json(
          {
            error: {
              code: 100,
              message: "Invalid",
              error_user_msg: "Budget is too low.",
            },
          },
          400,
        ),
      )
      .mockResolvedValueOnce(json({ success: true }));
    await expect(client.createDraft("tok", draft)).rejects.toMatchObject({
      code: "META_REJECTED",
      message: "Budget is too low.",
    });
    const last = fetchMock.mock.calls[2]!;
    expect(last[0] as string).toContain("/c1");
    expect(last[1]?.method).toBe("DELETE");
  });

  it("does not retry a write after a transient failure", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 2, message: "Temporary" } }, 500),
    );
    await expect(client.setStatus("tok", "c1", "PAUSED")).rejects.toMatchObject(
      {
        code: "META_UNAVAILABLE",
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
