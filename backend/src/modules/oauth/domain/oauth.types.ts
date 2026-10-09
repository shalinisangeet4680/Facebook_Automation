export interface AuthorizationParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state?: string;
  scope?: string;
  resource?: string;
}

export interface AuthorizationContext {
  client: {
    name: string;
    kind: "dcr" | "cimd";
    clientUri: string | null;
    logoUri: string | null;
  };
  redirectHost: string;
  workspace: { id: string; name: string };
  adAccount: { id: string; name: string } | null;
  writeRequested: boolean;
}

export interface StoredCode {
  grantId: string;
  clientId: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface ConnectedAppView {
  id: string;
  name: string;
  kind: "dcr" | "cimd";
  clientUri: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}
