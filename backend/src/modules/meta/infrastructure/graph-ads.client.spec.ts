import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { GraphAdsClient, leadFormParams, toAd } from "./graph-ads.client";

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

  it("replaces an ad's creative by creating a new one and pointing the ad at it", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "cr2" }))
      .mockResolvedValueOnce(json({ success: true }));
    const result = await client.replaceCreative("tok", {
      adAccountId: "act_1",
      adId: "a1",
      name: "Ad – edited",
      creative: { ...draft.creative, headline: "New", imageHash: "h1" },
    });
    expect(result).toEqual({ creativeId: "cr2" });
    const [first, second] = fetchMock.mock.calls;
    const bodyOf = (c: typeof first) => c![1]!.body as URLSearchParams;
    expect(first![0] as string).toContain("/act_1/adcreatives");
    const spec = JSON.parse(bodyOf(first).get("object_story_spec")!);
    expect(spec).toEqual({
      page_id: "p1",
      link_data: {
        link: "https://example.com/",
        message: "Hello",
        name: "New",
        image_hash: "h1",
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: "https://example.com/" },
        },
      },
    });
    expect(second![0] as string).toContain("/a1");
    expect(JSON.parse(bodyOf(second).get("creative")!)).toEqual({
      creative_id: "cr2",
    });
  });

  it("tells link ads apart from ads that run on an existing post", () => {
    const base = {
      id: "a1",
      name: "Ad",
      adset_id: "s1",
      status: "ACTIVE",
      effective_status: "ACTIVE",
    };
    const link = toAd({
      ...base,
      creative: {
        id: "cr1",
        thumbnail_url: "https://t/1.png",
        object_story_spec: {
          page_id: "p1",
          link_data: {
            link: "https://example.com/",
            message: "Body",
            name: "Head",
            description: "Desc",
            image_hash: "h1",
            call_to_action: { type: "SIGN_UP" },
          },
        },
      },
    });
    expect(link.creative).toMatchObject({
      kind: "link",
      title: "Head",
      body: "Body",
      description: "Desc",
      imageHash: "h1",
      pageId: "p1",
      callToAction: "SIGN_UP",
      postId: null,
    });
    expect(
      toAd({
        ...base,
        creative: { id: "cr2", object_story_id: "p1_42" },
      }).creative,
    ).toMatchObject({ kind: "post", postId: "p1_42" });
    expect(
      toAd({
        ...base,
        creative: { id: "cr3", source_instagram_media_id: "m9" },
      }).creative,
    ).toMatchObject({ kind: "post", postId: "m9" });
    expect(
      toAd({ ...base, creative: { id: "cr4", object_story_spec: {} } }).creative
        ?.kind,
    ).toBe("other");
  });

  describe("instant form ads", () => {
    const leadForm = {
      pageId: "p1",
      name: "Free demo – Instant form",
      locale: "EN_US",
      intro: { headline: "Free demo", description: "We'll call you." },
      questions: ["FULL_NAME", "PHONE", "CITY"],
      customQuestions: [
        {
          key: "custom_1",
          label: "Best time to call?",
          options: ["Morning", "Evening"],
        },
        { key: "custom_2", label: "Clinic name", options: [] },
      ],
      privacyPolicyUrl: "https://example.com/privacy",
      thankYou: {
        title: "Thanks!",
        body: "We'll be in touch.",
        button: {
          type: "website" as const,
          text: "Visit website",
          url: "https://example.com/",
        },
      },
    };
    const instant = {
      ...draft,
      objective: "OUTCOME_LEADS",
      adSet: {
        ...draft.adSet,
        optimizationGoal: "LEAD_GENERATION",
        destinationType: "ON_AD",
        promotedObject: { page_id: "p1" },
      },
      creative: { ...draft.creative, callToAction: "SIGN_UP" },
      leadForm,
    };
    const urlOf = (i: number) => fetchMock.mock.calls[i]![0] as string;
    const bodyOf = (i: number) =>
      fetchMock.mock.calls[i]![1]?.body as URLSearchParams;

    it("creates the form with a Page token and points the ad at it", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ access_token: "page-tok", id: "p1" }))
        .mockResolvedValueOnce(json({ id: "f1" }))
        .mockResolvedValueOnce(json({ id: "c1" }))
        .mockResolvedValueOnce(json({ id: "s1" }))
        .mockResolvedValueOnce(json({ id: "cr1" }))
        .mockResolvedValueOnce(json({ id: "a1" }));
      const result = await client.createDraft("tok", instant);
      expect(result).toEqual({
        campaignId: "c1",
        adSetId: "s1",
        creativeId: "cr1",
        adId: "a1",
        leadFormId: "f1",
      });
      expect(urlOf(0)).toContain("/p1?fields=access_token");
      expect(urlOf(1)).toContain("/p1/leadgen_forms");
      expect(
        (fetchMock.mock.calls[1]![1]!.headers as Record<string, string>)
          .Authorization,
      ).toBe("Bearer page-tok");
      expect(JSON.parse(bodyOf(1).get("privacy_policy")!)).toEqual({
        url: "https://example.com/privacy",
        link_text: "Privacy policy",
      });
      expect(bodyOf(2).get("objective")).toBe("OUTCOME_LEADS");
      expect(bodyOf(3).get("destination_type")).toBe("ON_AD");
      expect(bodyOf(3).get("optimization_goal")).toBe("LEAD_GENERATION");
      expect(bodyOf(3).get("billing_event")).toBe("IMPRESSIONS");
      expect(JSON.parse(bodyOf(3).get("promoted_object")!)).toEqual({
        page_id: "p1",
      });
      const spec = JSON.parse(bodyOf(4).get("object_story_spec")!);
      expect(spec.link_data.call_to_action).toEqual({
        type: "SIGN_UP",
        value: { lead_gen_form_id: "f1" },
      });
    });

    it("maps the form spec to Meta's leadgen form fields", () => {
      const params = leadFormParams(leadForm);
      expect(params.questions).toEqual([
        { type: "FULL_NAME" },
        { type: "PHONE" },
        { type: "CITY" },
        {
          type: "CUSTOM",
          key: "custom_1",
          label: "Best time to call?",
          options: [
            { key: "custom_1_1", value: "Morning" },
            { key: "custom_1_2", value: "Evening" },
          ],
        },
        { type: "CUSTOM", key: "custom_2", label: "Clinic name" },
      ]);
      expect(params.context_card).toEqual({
        title: "Free demo",
        style: "PARAGRAPH_STYLE",
        content: ["We'll call you."],
      });
      expect(params.thank_you_page).toEqual({
        title: "Thanks!",
        body: "We'll be in touch.",
        button_text: "Visit website",
        button_type: "VIEW_WEBSITE",
        website_url: "https://example.com/",
      });
      expect(
        leadFormParams({
          ...leadForm,
          thankYou: {
            ...leadForm.thankYou,
            button: { type: "call", text: "Call us", phone: "+919876543210" },
          },
        }).thank_you_page,
      ).toMatchObject({
        button_type: "CALL_BUSINESS",
        business_phone_number: "+919876543210",
      });
    });

    it("archives the form and deletes the campaign when a later step fails", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ access_token: "page-tok" }))
        .mockResolvedValueOnce(json({ id: "f1" }))
        .mockResolvedValueOnce(json({ id: "c1" }))
        .mockResolvedValueOnce(
          json({ error: { code: 100, message: "Bad targeting" } }, 400),
        )
        .mockResolvedValueOnce(json({ success: true }))
        .mockResolvedValueOnce(json({ success: true }));
      await expect(client.createDraft("tok", instant)).rejects.toMatchObject({
        code: "META_REJECTED",
      });
      expect(urlOf(4)).toContain("/c1");
      expect(fetchMock.mock.calls[4]![1]?.method).toBe("DELETE");
      expect(urlOf(5)).toContain("/f1");
      expect(bodyOf(5).get("status")).toBe("ARCHIVED");
    });

    it("pages through leads newer than the cursor", async () => {
      fetchMock
        .mockResolvedValueOnce(
          json({
            data: [
              {
                id: "l2",
                created_time: "2026-10-19T10:00:00+0000",
                field_data: [{ name: "full_name", values: ["Priya"] }],
                ad_id: "a1",
                campaign_id: "c1",
                campaign_name: "Demo",
              },
            ],
            paging: { next: "https://graph.facebook.com/v23.0/next-page" },
          }),
        )
        .mockResolvedValueOnce(
          json({
            data: [{ id: "l1", created_time: "2026-10-19T09:00:00+0000" }],
          }),
        );
      const leads = await client.leads("page-tok", "f1", 1_760_000_000);
      const url = new URL(urlOf(0));
      expect(url.pathname).toBe("/v23.0/f1/leads");
      expect(JSON.parse(url.searchParams.get("filtering")!)).toEqual([
        {
          field: "time_created",
          operator: "GREATER_THAN",
          value: 1_760_000_000,
        },
      ]);
      expect(url.searchParams.get("fields")).toContain("field_data");
      expect(leads.map((l) => l.id)).toEqual(["l2", "l1"]);
      expect(leads[0]).toMatchObject({
        formId: "f1",
        createdTime: "2026-10-19T10:00:00.000Z",
        campaignName: "Demo",
        adSetId: null,
      });
    });

    it("reads the form id back from a lead ad's creative", () => {
      const ad = toAd({
        id: "a1",
        name: "Ad",
        adset_id: "s1",
        status: "PAUSED",
        effective_status: "PAUSED",
        creative: {
          id: "cr1",
          object_story_spec: {
            page_id: "p1",
            link_data: {
              link: "https://example.com/",
              call_to_action: {
                type: "SIGN_UP",
                value: { lead_gen_form_id: "f1" },
              },
            },
          },
        },
      });
      expect(ad.creative?.leadFormId).toBe("f1");
    });
  });
});
