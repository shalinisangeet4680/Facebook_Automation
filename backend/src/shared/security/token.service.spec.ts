import { JwtService } from "@nestjs/jwt";

import { TokenService } from "./token.service";

describe("TokenService", () => {
  const jwt = new JwtService({
    secret: "x".repeat(48),
    signOptions: { algorithm: "HS256", expiresIn: 900 },
    verifyOptions: { algorithms: ["HS256"] },
  });
  const tokens = new TokenService(jwt);
  const input = { userId: "u1", workspaceId: "w1", sessionId: "s1" };

  it("round-trips the tenant context", () => {
    expect(tokens.verifyAccess(tokens.signAccess(input))).toEqual(input);
  });

  it("rejects tokens signed with another secret", () => {
    const other = new TokenService(
      new JwtService({ secret: "y".repeat(48) }),
    ).signAccess(input);
    expect(() => tokens.verifyAccess(other)).toThrow();
  });

  it("rejects non-access tokens", () => {
    const refreshLike = jwt.sign({ sub: "u1", typ: "refresh" });
    expect(() => tokens.verifyAccess(refreshLike)).toThrow();
  });

  it("rejects expired tokens", () => {
    const expired = jwt.sign(
      { sub: "u1", typ: "access", wid: "w1", sid: "s1" },
      { expiresIn: -1 },
    );
    expect(() => tokens.verifyAccess(expired)).toThrow();
  });

  describe("MCP tokens", () => {
    const mcp = {
      userId: "u1",
      workspaceId: "w1",
      grantId: "g1",
      clientId: "c1",
      scopes: ["ads:read", "ads:write"],
      audience: "https://app.example/mcp",
      ttlSeconds: 3600,
    };

    it("round-trips for the right audience", () => {
      const token = tokens.signMcp(mcp);
      expect(tokens.verifyMcp(token, mcp.audience)).toEqual({
        userId: "u1",
        workspaceId: "w1",
        grantId: "g1",
        clientId: "c1",
        scopes: ["ads:read", "ads:write"],
      });
    });

    it("rejects another audience", () => {
      const token = tokens.signMcp(mcp);
      expect(() =>
        tokens.verifyMcp(token, "https://other.example/mcp"),
      ).toThrow();
    });

    it("is not accepted as an app access token and vice versa", () => {
      expect(() => tokens.verifyAccess(tokens.signMcp(mcp))).toThrow();
      const access = tokens.signAccess(input);
      expect(() => tokens.verifyMcp(access, mcp.audience)).toThrow();
    });
  });
});
