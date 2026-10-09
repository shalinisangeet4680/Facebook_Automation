export interface AccessTokenClaims {
  sub: string;
  typ: "access";
  wid: string;
  sid: string;
  iat?: number;
  exp?: number;
}

export interface AccessClaimsInput {
  userId: string;
  workspaceId: string;
  sessionId: string;
}

export interface McpTokenClaims {
  sub: string;
  typ: "mcp";
  wid: string;
  gid: string;
  cid: string;
  scope: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export interface McpClaimsInput {
  userId: string;
  workspaceId: string;
  grantId: string;
  clientId: string;
  scopes: string[];
  audience: string;
  ttlSeconds: number;
}

export interface McpAuth {
  userId: string;
  workspaceId: string;
  grantId: string;
  clientId: string;
  scopes: string[];
}
