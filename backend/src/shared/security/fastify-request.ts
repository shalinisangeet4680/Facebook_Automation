import { TenantContext } from "@shared/tenant/tenant-context";

import { McpAuth } from "./jwt-claims";

declare module "fastify" {
  interface FastifyRequest {
    auth?: TenantContext;
    mcp?: McpAuth;
  }
}
