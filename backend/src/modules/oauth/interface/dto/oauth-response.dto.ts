export class AuthorizationClientDto {
  name: string;
  kind: "dcr" | "cimd";
  clientUri: string | null;
  logoUri: string | null;
}

export class AuthorizationWorkspaceDto {
  id: string;
  name: string;
}

export class AuthorizationAdAccountDto {
  id: string;
  name: string;
}

export class AuthorizationContextDto {
  client: AuthorizationClientDto;
  redirectHost: string;
  workspace: AuthorizationWorkspaceDto;
  adAccount: AuthorizationAdAccountDto | null;
  writeRequested: boolean;
}

export class AuthorizationRedirectDto {
  redirectTo: string;
}

export class ConnectedAppDto {
  id: string;
  name: string;
  kind: "dcr" | "cimd";
  clientUri: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

export class ConnectedAppListDto {
  data: ConnectedAppDto[];
}

export class ConnectorInfoDto {
  mcpUrl: string;
  maxDailyBudget: number;
}
