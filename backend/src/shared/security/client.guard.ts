import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";

import { ForbiddenError } from "@shared/errors/domain-error";

import { CLIENT_HEADER } from "./auth-cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CLIENTS = new Set(["web", "mobile"]);

@Injectable()
export class ClientGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    const client = request.headers[CLIENT_HEADER];
    if (typeof client === "string" && CLIENTS.has(client)) return true;
    throw new ForbiddenError(
      "Requests must include the X-Client header (web or mobile).",
    );
  }
}
