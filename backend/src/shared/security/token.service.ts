import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { TenantContext } from "@shared/tenant/tenant-context";

import {
  AccessClaimsInput,
  AccessTokenClaims,
  McpAuth,
  McpClaimsInput,
  McpTokenClaims,
} from "./jwt-claims";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccess(input: AccessClaimsInput): string {
    const claims: AccessTokenClaims = {
      sub: input.userId,
      typ: "access",
      wid: input.workspaceId,
      sid: input.sessionId,
    };
    return this.jwt.sign(claims);
  }

  verifyAccess(token: string): TenantContext {
    const claims = this.jwt.verify<AccessTokenClaims>(token);
    if (claims.typ !== "access") throw new Error("Not an access token");
    return {
      userId: claims.sub,
      workspaceId: claims.wid,
      sessionId: claims.sid,
    };
  }

  signMcp(input: McpClaimsInput): string {
    const claims: McpTokenClaims = {
      sub: input.userId,
      typ: "mcp",
      wid: input.workspaceId,
      gid: input.grantId,
      cid: input.clientId,
      scope: input.scopes.join(" "),
    };
    return this.jwt.sign(claims, {
      audience: input.audience,
      expiresIn: input.ttlSeconds,
    });
  }

  verifyMcp(token: string, audience: string): McpAuth {
    const claims = this.jwt.verify<McpTokenClaims>(token, { audience });
    if (claims.typ !== "mcp") throw new Error("Not an MCP token");
    return {
      userId: claims.sub,
      workspaceId: claims.wid,
      grantId: claims.gid,
      clientId: claims.cid,
      scopes: claims.scope.split(" ").filter(Boolean),
    };
  }
}
