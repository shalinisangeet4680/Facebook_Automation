import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { GraphApiClient } from "./graph-api.client";

class TestClient extends GraphApiClient {
  protected override wait(): Promise<void> {
    return Promise.resolve();
  }
}

const config = {
  get: () => "v23.0",
} as unknown as ConfigService<Env, true>;

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("GraphApiClient", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const client = new TestClient(config);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterAll(() => vi.unstubAllGlobals());

  it("sends the token as a Bearer header, never in the URL", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: "1", name: "Bot" }));
    await client.identity("EAAsecret");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("EAAsecret");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer EAAsecret",
    );
  });

  it("follows pagination", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          data: [{ permission: "ads_read", status: "granted" }],
          paging: { next: "https://graph.facebook.com/v23.0/next" },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            { permission: "ads_management", status: "granted" },
            { permission: "leads_retrieval", status: "declined" },
          ],
        }),
      );
    expect(await client.grantedPermissions("EAAx")).toEqual([
      "ads_read",
      "ads_management",
    ]);
  });

  it("maps expired tokens to META_TOKEN_INVALID without retrying", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 190, message: "Session expired" } }, 400),
    );
    await expect(client.identity("EAAx")).rejects.toMatchObject({
      code: "META_TOKEN_INVALID",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ error: { code: 2, message: "Temporary" } }, 500),
      )
      .mockResolvedValueOnce(json({ id: "1", name: "Bot" }));
    expect(await client.identity("EAAx")).toEqual({ id: "1", name: "Bot" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports throttling with a retry hint after exhausting attempts", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          { error: { code: 17, message: "User request limit reached" } },
          400,
          {
            "x-business-use-case-usage": JSON.stringify({
              "123": [{ estimated_time_to_regain_access: 3 }],
            }),
          },
        ),
      ),
    );
    await expect(client.identity("EAAx")).rejects.toMatchObject({
      code: "META_THROTTLED",
      details: { retryAfterSeconds: 180 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("turns network failures into META_UNAVAILABLE", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(client.identity("EAAx")).rejects.toMatchObject({
      code: "META_UNAVAILABLE",
    });
  });
});
