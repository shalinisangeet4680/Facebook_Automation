import { FastifyReply, FastifyRequest } from "fastify";

import {
  ACCESS_COOKIE,
  CLIENT_HEADER,
  ClientKind,
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
} from "@shared/security/auth-cookies";

import { IssuedTokens, RequestMeta } from "../domain/auth.types";

export interface CookieScope {
  secure: boolean;
  domain?: string;
}

const ACCESS_PATH = "/api";
const REFRESH_PATH = "/api/v1/auth";

export function clientKind(request: FastifyRequest): ClientKind {
  return request.headers[CLIENT_HEADER] === "mobile" ? "mobile" : "web";
}

export function requestMeta(request: FastifyRequest): RequestMeta {
  const ua = request.headers["user-agent"];
  return {
    ip: request.ip ?? null,
    userAgent: typeof ua === "string" ? ua : null,
  };
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: IssuedTokens,
  options: CookieScope,
): void {
  const base = { httpOnly: true, ...options, sameSite: "lax" as const };
  void reply.setCookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: ACCESS_PATH,
    maxAge: tokens.accessTokenExpiresIn,
  });
  void reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: tokens.refreshTokenExpiresIn,
  });
  void reply.setCookie(SESSION_HINT_COOKIE, "1", {
    ...base,
    path: "/",
    maxAge: tokens.refreshTokenExpiresIn,
  });
}

export function clearAuthCookies(
  reply: FastifyReply,
  options: CookieScope,
): void {
  const base = { httpOnly: true, ...options, sameSite: "lax" as const };
  void reply.clearCookie(ACCESS_COOKIE, { ...base, path: ACCESS_PATH });
  void reply.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
  void reply.clearCookie(SESSION_HINT_COOKIE, { ...base, path: "/" });
}

export function readRefreshCookie(request: FastifyRequest): string | null {
  return request.cookies?.[REFRESH_COOKIE] ?? null;
}
