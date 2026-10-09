import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";

import { UnauthorizedError } from "@shared/errors/domain-error";
import { TenantContext } from "@shared/tenant/tenant-context";

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext => {
    const auth = ctx.switchToHttp().getRequest<FastifyRequest>().auth;
    if (!auth) throw new UnauthorizedError("Please sign in to continue.");
    return auth;
  },
);
