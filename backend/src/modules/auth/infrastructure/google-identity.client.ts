import { GoogleIdentity } from "@modules/iam/domain/identity.types";

import {
  GoogleIdentityProvider,
  GoogleSignInError,
} from "../domain/ports/google-identity";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export class GoogleIdentityClient implements GoogleIdentityProvider {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  authUrl(redirectUri: string, state: string, hint?: string): string {
    const url = new URL(AUTH);
    if (hint) url.searchParams.set("login_hint", hint);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchange(code: string, redirectUri: string): Promise<GoogleIdentity> {
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok)
      throw new GoogleSignInError("Google sign-in didn’t finish. Try again.");
    const { access_token } = (await res.json()) as { access_token: string };
    const info = await fetch(USERINFO, {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!info.ok)
      throw new GoogleSignInError(
        "Google didn’t share your account details. Try again.",
      );
    const user = (await info.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!user.sub || !user.email || !user.email_verified)
      throw new GoogleSignInError(
        "Use a Google account with a verified email.",
      );
    return {
      sub: user.sub,
      email: user.email.toLowerCase(),
      name: user.name ?? null,
      picture: user.picture ?? null,
    };
  }
}

export class MockGoogleIdentity implements GoogleIdentityProvider {
  constructor(private readonly email: string) {}

  authUrl(redirectUri: string, state: string, hint?: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set("code", hint ?? "mock");
    url.searchParams.set("state", state);
    return url.toString();
  }

  exchange(code: string): Promise<GoogleIdentity> {
    if (code === "unverified")
      return Promise.reject(
        new GoogleSignInError("Use a Google account with a verified email."),
      );
    const email =
      code === "mock"
        ? this.email
        : code.includes("@")
          ? code
          : `${code}@example.com`;
    return Promise.resolve({
      sub: `mock-${email}`,
      email,
      name: email.split("@")[0]!.replace(/[._]/g, " "),
      picture: null,
    });
  }
}
