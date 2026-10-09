import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { AuthGuard } from "./auth.guard";
import { ClientGuard } from "./client.guard";
import { TokenService } from "./token.service";

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("AuthGuard", () => {
  const tokens = new TokenService(
    new JwtService({ secret: "z".repeat(48), signOptions: { expiresIn: 900 } }),
  );
  const token = tokens.signAccess({
    userId: "u1",
    workspaceId: "w1",
    sessionId: "s1",
  });
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, tokens);

  it("accepts a Bearer token and sets the tenant context", () => {
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };
    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.auth).toEqual({
      userId: "u1",
      workspaceId: "w1",
      sessionId: "s1",
    });
  });

  it("accepts the access cookie", () => {
    const request = { headers: {}, cookies: { access_token: token } };
    expect(guard.canActivate(contextFor(request))).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(
      "Please sign in to continue.",
    );
  });

  it("rejects a tampered token", () => {
    const request = { headers: { authorization: `Bearer ${token}x` } };
    expect(() => guard.canActivate(contextFor(request))).toThrow(
      "Your session has expired. Please sign in again.",
    );
  });

  it("allows public routes", () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce(true);
    expect(guard.canActivate(contextFor({ headers: {} }))).toBe(true);
  });
});

describe("ClientGuard", () => {
  const guard = new ClientGuard();

  it("lets safe methods through without the header", () => {
    expect(guard.canActivate(contextFor({ method: "GET", headers: {} }))).toBe(
      true,
    );
  });

  it("requires X-Client on state-changing requests", () => {
    expect(() =>
      guard.canActivate(contextFor({ method: "POST", headers: {} })),
    ).toThrow();
    expect(
      guard.canActivate(
        contextFor({ method: "POST", headers: { "x-client": "web" } }),
      ),
    ).toBe(true);
  });

  it("rejects unknown client values", () => {
    expect(() =>
      guard.canActivate(
        contextFor({ method: "POST", headers: { "x-client": "curl" } }),
      ),
    ).toThrow();
  });
});
