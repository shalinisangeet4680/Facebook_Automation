import { SignInIdentity } from "@modules/iam/domain/identity.types";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
  sessionId: string;
}

export interface SignInResult extends SignInIdentity {
  tokens: IssuedTokens;
}

export interface OtpRequested {
  phone: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}
