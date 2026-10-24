import { createHash } from "crypto";

import { isValidChallenge, verifyPkce } from "./pkce";
import { isRegistrableRedirect, matchesRedirect } from "./redirect-uri";
import { grantableScopes, parseScopes, unsupportedScopes } from "./scopes";

describe("PKCE", () => {
  const verifier = "a".repeat(20) + "-._~" + "B9".repeat(12);
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  it("accepts the matching verifier", () => {
    expect(isValidChallenge(challenge)).toBe(true);
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it("rejects another verifier or a short one", () => {
    expect(verifyPkce(verifier + "x", challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
  });

  it("rejects plain challenges", () => {
    expect(isValidChallenge("not-a-challenge")).toBe(false);
  });
});

describe("redirect URIs", () => {
  it("allows https and loopback http only", () => {
    expect(
      isRegistrableRedirect("https://claude.ai/api/mcp/auth_callback"),
    ).toBe(true);
    expect(isRegistrableRedirect("http://localhost/callback")).toBe(true);
    expect(isRegistrableRedirect("http://example.com/callback")).toBe(false);
    expect(isRegistrableRedirect("https://claude.ai/cb#frag")).toBe(false);
    expect(isRegistrableRedirect("javascript:alert(1)")).toBe(false);
  });

  it("allows Cursor's app callback and no other custom scheme", () => {
    expect(
      isRegistrableRedirect("cursor://anysphere.cursor-mcp/oauth/callback"),
    ).toBe(true);
    expect(
      isRegistrableRedirect("cursor://anysphere.cursor-mcp/oauth/other"),
    ).toBe(false);
    expect(isRegistrableRedirect("vscode://callback")).toBe(false);
    expect(
      matchesRedirect(
        ["cursor://anysphere.cursor-mcp/oauth/callback"],
        "cursor://anysphere.cursor-mcp/oauth/callback",
      ),
    ).toBe(true);
  });

  it("matches exactly, or loopback with any port", () => {
    const registered = [
      "https://claude.ai/api/mcp/auth_callback",
      "http://localhost/callback",
      "http://127.0.0.1/callback",
    ];
    expect(
      matchesRedirect(registered, "https://claude.ai/api/mcp/auth_callback"),
    ).toBe(true);
    expect(matchesRedirect(registered, "http://localhost:51234/callback")).toBe(
      true,
    );
    expect(matchesRedirect(registered, "http://127.0.0.1:3118/callback")).toBe(
      true,
    );
    expect(matchesRedirect(registered, "http://localhost:3118/other")).toBe(
      false,
    );
    expect(matchesRedirect(registered, "https://claude.ai/api/mcp/other")).toBe(
      false,
    );
    expect(
      matchesRedirect(registered, "https://evil.example/api/mcp/auth_callback"),
    ).toBe(false);
  });
});

describe("scopes", () => {
  it("defaults to the resource scopes", () => {
    expect(parseScopes("")).toEqual(["ads:read", "ads:write"]);
  });

  it("reports unknown scopes", () => {
    expect(unsupportedScopes(parseScopes("ads:read admin"))).toEqual(["admin"]);
  });

  it("grants write only when the user allows it", () => {
    expect(grantableScopes(["ads:read", "ads:write"], false)).toEqual([
      "ads:read",
    ]);
    expect(grantableScopes(["ads:read", "ads:write"], true)).toEqual([
      "ads:read",
      "ads:write",
    ]);
    expect(grantableScopes(["ads:read"], true)).toEqual(["ads:read"]);
  });
});
