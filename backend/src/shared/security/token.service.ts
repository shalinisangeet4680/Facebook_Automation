import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { TenantContext } from "@shared/tenant/tenant-context";

import { AccessClaimsInput, AccessTokenClaims } from "./jwt-claims";

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
}
