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

import { AuditService } from "@modules/audit/application/audit.service";
import { allowedOrigin, cookieOptions } from "@shared/config/app-config";
import { CryptoService } from "@shared/security/crypto.service";
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
import {
  GOOGLE_IDENTITY,
  GoogleIdentityProvider,
  GoogleSignInError,
} from "../domain/ports/google-identity";
import { DeliveredTokens, IssuedTokens } from "../domain/auth.types";
import {
  clearAuthCookies,
  CookieScope,
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
import {
  GoogleCallbackQueryDto,
  GoogleStartQueryDto,
} from "./dto/google-sign-in.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

const HOUR = 3_600_000;
const STATE_COOKIE = "tv_google_state";
const STATE_PATH = "/api/v1/auth/google";
const STATE_TTL_MS = 10 * 60_000;

const safeNext = (value?: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

@ApiTags("Auth")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("auth")
export class AuthController {
  private readonly cookies: CookieScope;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    @Inject(GOOGLE_IDENTITY) private readonly google: GoogleIdentityProvider,
  ) {
    this.cookies = cookieOptions(config);
  }

  private googleRedirect(origin: string) {
    return `${origin}/api/v1/auth/google/callback`;
  }

  @Public()
  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Get("google/start")
  async googleStart(
    @Query() query: GoogleStartQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const origin = allowedOrigin(this.config, query.origin);
    const nonce = this.crypto.randomToken(16);
    const state = Buffer.from(
      this.crypto.encrypt(
        JSON.stringify({
          n: nonce,
          o: origin,
          x: safeNext(query.next),
          e: Date.now() + STATE_TTL_MS,
        }),
      ),
    ).toString("base64url");
    void reply.setCookie(STATE_COOKIE, nonce, {
      ...this.cookies,
      httpOnly: true,
      sameSite: "lax",
      path: STATE_PATH,
      maxAge: STATE_TTL_MS / 1000,
    });
    await reply.redirect(
      this.google.authUrl(this.googleRedirect(origin), state, query.hint),
      302,
    );
  }

  @Public()
  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Get("google/callback")
  async googleCallback(
    @Query() query: GoogleCallbackQueryDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    let state: { n: string; o: string; x: string; e: number } | null = null;
    try {
      state = query.state
        ? (JSON.parse(
            this.crypto.decrypt(
              Buffer.from(query.state, "base64url").toString(),
            ),
          ) as { n: string; o: string; x: string; e: number })
        : null;
    } catch {
      state = null;
    }
    const origin = allowedOrigin(this.config, state?.o);
    const next = safeNext(state?.x);
    const fail = async (message: string) => {
      const url = new URL("/login", origin);
      url.searchParams.set("error", message);
      if (next !== "/") url.searchParams.set("next", next);
      await reply.redirect(url.toString(), 302);
    };
    void reply.clearCookie(STATE_COOKIE, { ...this.cookies, path: STATE_PATH });
    if (query.error)
      return fail(
        query.error === "access_denied"
          ? "Google sign-in was cancelled."
          : "Google sign-in didn’t finish. Try again.",
      );
    const cookieNonce = request.cookies?.[STATE_COOKIE];
    if (
      !state ||
      !query.code ||
      state.e < Date.now() ||
      !cookieNonce ||
      !this.crypto.safeEqual(cookieNonce, state.n)
    )
      return fail("This sign-in link expired. Try again.");
    try {
      const identity = await this.google.exchange(
        query.code,
        this.googleRedirect(origin),
      );
      const result = await this.auth.signInWithGoogle(
        identity,
        requestMeta(request),
      );
      setAuthCookies(reply, result.tokens, this.cookies);
      await reply.redirect(`${origin}${next === "/" ? "/setup" : next}`, 302);
    } catch (err) {
      if (err instanceof GoogleSignInError) return fail(err.message);
      throw err;
    }
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
      clearAuthCookies(reply, this.cookies);
      throw sessionEnded();
    }
    try {
      const tokens = await this.sessions.refresh(raw, requestMeta(request));
      return this.deliver(request, reply, tokens);
    } catch (err) {
      if (err instanceof DomainError && err.httpStatus === 401) {
        clearAuthCookies(reply, this.cookies);
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
    clearAuthCookies(reply, this.cookies);
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
    clearAuthCookies(reply, this.cookies);
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
    setAuthCookies(reply, tokens, this.cookies);
    return { accessTokenExpiresIn: tokens.accessTokenExpiresIn };
  }
}
