import { TenantContext } from "@shared/tenant/tenant-context";

declare module "fastify" {
  interface FastifyRequest {
    auth?: TenantContext;
  }
}
