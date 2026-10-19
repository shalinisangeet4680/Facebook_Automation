import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiDefaultResponse,
  ApiExcludeEndpoint,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyReply, FastifyRequest } from "fastify";

import { AppConfig, cookieOptions } from "@shared/config/app-config";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { Public } from "@shared/security/public.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { MetaOAuthService } from "../application/meta-oauth.service";
import { MetaOAuthStatusDto, MetaOAuthUrlDto } from "./dto/meta-response.dto";
import {
  MetaOAuthCallbackQueryDto,
  StartMetaOAuthDto,
} from "./dto/meta-oauth.dto";

export const META_OAUTH_STATE_COOKIE = "tv_meta_ads_state";
const STATE_PATH = "/api/v1/meta/oauth";
const HOUR = 3_600_000;

@ApiTags("Meta")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("meta/oauth")
export class MetaOAuthController {
  constructor(
    private readonly oauth: MetaOAuthService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  @Get("status")
  status(): MetaOAuthStatusDto {
    return this.oauth.status();
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post("start")
  @HttpCode(HttpStatus.OK)
  async start(
    @CurrentUser() ctx: TenantContext,
    @Body() body: StartMetaOAuthDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MetaOAuthUrlDto> {
    const started = await this.oauth.start(ctx, body);
    void reply.setCookie(META_OAUTH_STATE_COOKIE, started.nonce, {
      ...cookieOptions(this.config),
      httpOnly: true,
      sameSite: "lax",
      path: STATE_PATH,
      maxAge: started.ttlSeconds,
    });
    return { url: started.url };
  }

  @Public()
  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Get("callback")
  async callback(
    @Query() query: MetaOAuthCallbackQueryDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const url = await this.oauth.callback(
      query,
      request.cookies?.[META_OAUTH_STATE_COOKIE],
    );
    void reply.clearCookie(META_OAUTH_STATE_COOKIE, {
      ...cookieOptions(this.config),
      path: STATE_PATH,
    });
    await reply.redirect(url, 302);
  }
}
