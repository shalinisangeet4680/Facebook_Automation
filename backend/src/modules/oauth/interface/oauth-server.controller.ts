import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

import { AppConfig, appUrl, mcpResourceUrl } from "@shared/config/app-config";
import { ExternalClient, Public } from "@shared/security/public.decorator";

import {
  ClientRegistryService,
  RegistrationResponse,
} from "../application/client-registry.service";
import { TokenEndpointService } from "../application/token-endpoint.service";
import {
  RESOURCE_SCOPES,
  SUPPORTED_SCOPES,
  TOKEN_AUTH_METHODS,
} from "../domain/oauth.policy";
import { TokenResponse } from "../domain/oauth.types";

type Form = Record<string, unknown>;

@ApiExcludeController()
@Public()
@ExternalClient()
@Controller({ version: VERSION_NEUTRAL })
export class OAuthServerController {
  constructor(
    private readonly registry: ClientRegistryService,
    private readonly tokens: TokenEndpointService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  @SkipThrottle()
  @Get([
    ".well-known/oauth-protected-resource",
    ".well-known/oauth-protected-resource/mcp",
  ])
  @Header("Cache-Control", "public, max-age=300")
  protectedResource() {
    return {
      resource: mcpResourceUrl(this.config),
      authorization_servers: [appUrl(this.config)],
      scopes_supported: RESOURCE_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Ads Autopilot",
    };
  }

  @SkipThrottle()
  @Get(".well-known/oauth-authorization-server")
  @Header("Cache-Control", "public, max-age=300")
  authorizationServer() {
    const base = appUrl(this.config);
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      revocation_endpoint: `${base}/oauth/revoke`,
      scopes_supported: SUPPORTED_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: TOKEN_AUTH_METHODS,
      revocation_endpoint_auth_methods_supported: TOKEN_AUTH_METHODS,
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    };
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("oauth/register")
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  register(@Body() body: Form): Promise<RegistrationResponse> {
    return this.registry.register(body ?? {});
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("oauth/token")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  token(
    @Body() body: Form,
    @Headers("authorization") authorization?: string,
  ): Promise<TokenResponse> {
    return this.tokens.exchange(body ?? {}, authorization);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("oauth/revoke")
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Body() body: Form,
    @Headers("authorization") authorization?: string,
  ): Promise<Record<string, never>> {
    await this.tokens.revoke(body ?? {}, authorization);
    return {};
  }
}
