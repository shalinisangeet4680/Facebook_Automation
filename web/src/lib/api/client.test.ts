import { beforeEach, describe, expect, it, vi } from "vitest";

import { authFetch, onSessionExpired } from "./client";

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response("{}", { status: code });
const req = (path: string) => new Request(`http://localhost${path}`, { method: "GET" });

describe("authFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const expired = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    expired.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    onSessionExpired(expired);
  });

  it("passes successful responses through", async () => {
    fetchMock.mockResolvedValueOnce(ok({ a: 1 }));
    const res = await authFetch(req("/api/v1/me"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes once and retries after a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(status(401))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok({ a: 2 }));
    const res = await authFetch(req("/api/v1/me"));
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[1]![0])).toBe("/api/v1/auth/refresh");
  });

  it("treats SESSION_REFRESHED from another tab as success", async () => {
    fetchMock
      .mockResolvedValueOnce(status(401))
      .mockResolvedValueOnce(status(409))
      .mockResolvedValueOnce(ok());
    const res = await authFetch(req("/api/v1/me"));
    expect(res.status).toBe(200);
  });

  it("shares one refresh between concurrent 401s", async () => {
    let releaseRefresh: (r: Response) => void = () => undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/v1/auth/refresh")) {
        return new Promise<Response>((resolve) => {
          releaseRefresh = resolve;
        });
      }
      return Promise.resolve(status(401));
    });
    const a = authFetch(req("/api/v1/me"));
    const b = authFetch(req("/api/v1/onboarding"));
    await new Promise((r) => setTimeout(r, 0));
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      return Promise.resolve(url.endsWith("/refresh") ? ok() : ok({ fresh: true }));
    });
    releaseRefresh(ok());
    await Promise.all([a, b]);
    const refreshCalls = fetchMock.mock.calls.filter(([input]: [RequestInfo | URL, RequestInit?]) =>
      String(input instanceof Request ? input.url : input).endsWith("/api/v1/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("sends the user to sign in when refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(status(401)).mockResolvedValueOnce(status(401));
    const res = await authFetch(req("/api/v1/me"));
    expect(res.status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("never refreshes for auth endpoints", async () => {
    fetchMock.mockResolvedValueOnce(status(401));
    await authFetch(req("/api/v1/auth/refresh"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
