import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyReply, FastifyRequest } from "fastify";

import { AuditService } from "@modules/audit/application/audit.service";
import { isProduction } from "@shared/config/app-config";
import { DomainError } from "@shared/errors/domain-error";
import { Env } from "@shared/config/env.validation";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { Public } from "@shared/security/public.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AuthService } from "../application/auth.service";
import { OtpService } from "../application/otp.service";
import { SessionService } from "../application/session.service";
import { sessionEnded } from "../domain/auth.errors";
import { DeliveredTokens, IssuedTokens } from "../domain/auth.types";
import {
  clearAuthCookies,
  clientKind,
  readRefreshCookie,
  requestMeta,
  setAuthCookies,
} from "./auth-cookies";
import {
  OtpRequestedDto,
  SignInResponseDto,
  TokensResponseDto,
} from "./dto/auth-response.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

const HOUR = 3_600_000;

@ApiTags("Auth")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("auth")
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    config: ConfigService<Env, true>,
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {
    this.secureCookies = isProduction(config);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: HOUR } })
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  requestOtp(
    @Body() body: RequestOtpDto,
    @Req() request: FastifyRequest,
  ): Promise<OtpRequestedDto> {
    return this.otp.request(body.phone, requestMeta(request));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignInResponseDto> {
    const result = await this.auth.verifyAndSignIn(
      body.phone,
      body.code,
      requestMeta(request),
    );
    const { tokens, ...identity } = result;
    return { ...identity, ...this.deliver(request, reply, tokens) };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<TokensResponseDto> {
    const raw =
      clientKind(request) === "mobile"
        ? body.refreshToken
        : readRefreshCookie(request);
    if (!raw) {
      clearAuthCookies(reply, this.secureCookies);
      throw sessionEnded();
    }
    try {
      const tokens = await this.sessions.refresh(raw, requestMeta(request));
      return this.deliver(request, reply, tokens);
    } catch (err) {
      if (err instanceof DomainError && err.httpStatus === 401) {
        clearAuthCookies(reply, this.secureCookies);
      }
      throw err;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() ctx: TenantContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.sessions.logout(ctx.sessionId);
    clearAuthCookies(reply, this.secureCookies);
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "auth.signed_out",
    });
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() ctx: TenantContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.sessions.logoutAll(ctx.userId);
    clearAuthCookies(reply, this.secureCookies);
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "auth.signed_out_everywhere",
    });
  }

  private deliver(
    request: FastifyRequest,
    reply: FastifyReply,
    tokens: IssuedTokens,
  ): DeliveredTokens {
    if (clientKind(request) === "mobile") {
      return {
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
      };
    }
    setAuthCookies(reply, tokens, this.secureCookies);
    return { accessTokenExpiresIn: tokens.accessTokenExpiresIn };
  }
}
