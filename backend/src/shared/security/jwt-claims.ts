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
