export const SCOPES = {
  READ: "ads:read",
  WRITE: "ads:write",
  OFFLINE: "offline_access",
} as const;

export const RESOURCE_SCOPES: string[] = [SCOPES.READ, SCOPES.WRITE];
export const SUPPORTED_SCOPES: string[] = [...RESOURCE_SCOPES, SCOPES.OFFLINE];

export const OAUTH_POLICY = {
  codeTtlSeconds: 60,
  accessTokenTtlSeconds: 60 * 60,
  refreshTokenTtlDays: 30,
  refreshReuseGraceSeconds: 30,
  cimdCacheSeconds: 24 * 60 * 60,
  cimdTimeoutMs: 5_000,
  cimdMaxBytes: 64 * 1024,
  maxRedirectUris: 10,
} as const;

export const TOKEN_AUTH_METHODS = [
  "none",
  "client_secret_post",
  "client_secret_basic",
] as const;

export type TokenAuthMethod = (typeof TOKEN_AUTH_METHODS)[number];
