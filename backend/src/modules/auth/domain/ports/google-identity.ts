import { GoogleIdentity } from "@modules/iam/domain/identity.types";

export const GOOGLE_IDENTITY = Symbol("GOOGLE_IDENTITY");

export class GoogleSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSignInError";
  }
}

export interface GoogleIdentityProvider {
  authUrl(redirectUri: string, state: string, hint?: string): string;
  exchange(code: string, redirectUri: string): Promise<GoogleIdentity>;
}
