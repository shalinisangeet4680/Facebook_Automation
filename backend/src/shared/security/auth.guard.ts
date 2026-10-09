import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";

import { UnauthorizedError } from "@shared/errors/domain-error";

import { ACCESS_COOKIE } from "./auth-cookies";
import { IS_PUBLIC } from "./public.decorator";
import { TokenService } from "./token.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedError("Please sign in to continue.");
    try {
      request.auth = this.tokens.verifyAccess(token);
      return true;
    } catch {
      throw new UnauthorizedError(
        "Your session has expired. Please sign in again.",
      );
    }
  }

  private extractToken(request: FastifyRequest): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
    return request.cookies?.[ACCESS_COOKIE] ?? null;
  }
}
