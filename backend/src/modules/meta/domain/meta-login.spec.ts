import { loginDialogUrl, loginErrorMessage, safeNext } from "./meta-login";

describe("loginDialogUrl", () => {
  const url = new URL(
    loginDialogUrl({
      version: "v23.0",
      appId: "1652483653208979",
      configId: "998877",
      redirectUri: "https://ads.treevook.com/api/v1/meta/oauth/callback",
      state: "abc.def",
    }),
  );

  it("points at the versioned Facebook dialog", () => {
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v23.0/dialog/oauth");
  });

  it("asks for a system user token through the login configuration", () => {
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "1652483653208979",
      redirect_uri: "https://ads.treevook.com/api/v1/meta/oauth/callback",
      state: "abc.def",
      response_type: "code",
      config_id: "998877",
      override_default_response_type: "true",
    });
  });

  it("never falls back to user token scopes", () => {
    expect(url.searchParams.has("scope")).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/setup/start?step=connect_meta")).toBe(
      "/setup/start?step=connect_meta",
    );
  });

  it("rejects other sites", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});

describe("loginErrorMessage", () => {
  it("explains a cancelled sign-in", () => {
    expect(
      loginErrorMessage({
        error: "access_denied",
        error_reason: "user_denied",
      }),
    ).toBe("Facebook sign-in was cancelled.");
  });

  it("falls back to a retry message", () => {
    expect(loginErrorMessage({ error: "server_error" })).toBe(
      "Facebook sign-in didn't finish. Try again.",
    );
  });
});
