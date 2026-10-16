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
    existingPost: null as {
      platform: "facebook" | "instagram";
      id: string;
    } | null,
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

  it("runs an ad on an existing Facebook post", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ id: "x1" })));
    await client.createDraft("tok", {
      ...draft,
      creative: {
        ...draft.creative,
        existingPost: { platform: "facebook", id: "p1_123" },
      },
    });
    const body = fetchMock.mock.calls[2]![1]?.body as URLSearchParams;
    expect(body.get("object_story_id")).toBe("p1_123");
    expect(body.get("object_story_spec")).toBeNull();
  });

  it("runs an ad on an existing Instagram post with a call to action", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ id: "x1" })));
    await client.createDraft("tok", {
      ...draft,
      creative: {
        ...draft.creative,
        instagramId: "ig1",
        existingPost: { platform: "instagram", id: "m1" },
      },
    });
    const body = fetchMock.mock.calls[2]![1]?.body as URLSearchParams;
    expect(body.get("source_instagram_media_id")).toBe("m1");
    expect(body.get("instagram_user_id")).toBe("ig1");
    expect(body.get("object_id")).toBe("p1");
    expect(JSON.parse(body.get("call_to_action")!)).toEqual({
      type: "LEARN_MORE",
      value: { link: "https://example.com/" },
    });
  });

  it("detects campaigns, ad sets and ads from the fields Meta accepts", async () => {
    const invalidField = () =>
      json(
        {
          error: {
            code: 100,
            message: "(#100) Tried accessing nonexisting field (adset_id)",
          },
        },
        400,
      );
    fetchMock
      .mockResolvedValueOnce(invalidField())
      .mockResolvedValueOnce(invalidField())
      .mockResolvedValueOnce(
        json({
          id: "c1",
          name: "Camp",
          status: "PAUSED",
          effective_status: "PAUSED",
          account_id: "123",
          daily_budget: "50000",
        }),
      );
    expect(await client.object("tok", "c1")).toMatchObject({
      type: "campaign",
      campaignId: "c1",
      accountId: "act_123",
      dailyBudget: 50000,
    });

    fetchMock.mockResolvedValueOnce(invalidField()).mockResolvedValueOnce(
      json({
        id: "s1",
        name: "Set",
        status: "PAUSED",
        effective_status: "PAUSED",
        account_id: "123",
        campaign_id: "c1",
        daily_budget: "50000",
      }),
    );
    expect(await client.object("tok", "s1")).toMatchObject({
      type: "adset",
      campaignId: "c1",
      dailyBudget: 50000,
    });

    fetchMock.mockResolvedValueOnce(
      json({
        id: "a1",
        name: "Ad",
        status: "PAUSED",
        effective_status: "PAUSED",
        account_id: "123",
        campaign_id: "c1",
        adset_id: "s1",
      }),
    );
    expect(await client.object("tok", "a1")).toMatchObject({
      type: "ad",
      campaignId: "c1",
      dailyBudget: null,
    });
  });
});
