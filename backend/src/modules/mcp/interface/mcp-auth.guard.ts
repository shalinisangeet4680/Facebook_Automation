import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";
import Redis from "ioredis";

import { GrantService } from "@modules/oauth/application/grant.service";
import { RESOURCE_SCOPES } from "@modules/oauth/domain/oauth.policy";
import { REDIS } from "@shared/cache/redis";
import { AppConfig, appUrl, mcpResourceUrl } from "@shared/config/app-config";
import { ProtocolError } from "@shared/errors/domain-error";
import { TokenService } from "@shared/security/token.service";

export const MCP_REQUESTS_PER_MINUTE = 120;

declare module "fastify" {
  interface FastifyRequest {
    mcpClientName?: string;
  }
}

@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly grants: GrantService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw this.challenge();

    let auth;
    try {
      auth = this.tokens.verifyMcp(token, mcpResourceUrl(this.config));
    } catch {
      throw this.challenge(
        "invalid_token",
        "The access token is invalid or expired.",
      );
    }
    const grant = await this.grants.active(auth.grantId);
    if (!grant) {
      throw this.challenge(
        "invalid_token",
        "This connection was removed. Connect again.",
      );
    }

    const window = Math.floor(Date.now() / 60_000);
    const key = `mcp:rl:${auth.grantId}:${window}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 61);
    if (count > MCP_REQUESTS_PER_MINUTE) {
      throw new ProtocolError(
        429,
        {
          error: "rate_limited",
          error_description: "Too many requests. Slow down for a minute.",
        },
        { "Retry-After": "60" },
      );
    }

    request.mcp = auth;
    request.mcpClientName = grant.clientName;
    request.auth = {
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      sessionId: auth.grantId,
    };
    return true;
  }

  private challenge(error?: string, description?: string): ProtocolError {
    const metadata = `${appUrl(this.config)}/.well-known/oauth-protected-resource/mcp`;
    const parts = [
      `resource_metadata="${metadata}"`,
      `scope="${RESOURCE_SCOPES.join(" ")}"`,
      ...(error
        ? [`error="${error}"`, `error_description="${description}"`]
        : []),
    ];
    return new ProtocolError(
      401,
      {
        error: error ?? "unauthorized",
        error_description:
          description ?? "Sign in to Ads Autopilot to use this connector.",
      },
      { "WWW-Authenticate": `Bearer ${parts.join(", ")}` },
    );
  }
}
