import { Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
import { NotFoundError } from "@shared/errors/domain-error";
import { TenantContext } from "@shared/tenant/tenant-context";

import { ConnectedAppView } from "../domain/oauth.types";
import { OAuthGrantRepository } from "../infrastructure/oauth-grant.repository";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class GrantService {
  constructor(
    private readonly grants: OAuthGrantRepository,
    private readonly audit: AuditService,
  ) {}

  async active(grantId: string): Promise<{ clientName: string } | null> {
    const row = await this.grants.findActiveWithClient(grantId);
    if (!row) return null;
    const { grant, client } = row;
    if (
      !grant.lastUsedAt ||
      Date.now() - grant.lastUsedAt.getTime() > TOUCH_INTERVAL_MS
    ) {
      await this.grants.touch(
        grantId,
        new Date(Date.now() - TOUCH_INTERVAL_MS),
      );
    }
    return { clientName: client.name };
  }

  async list(ctx: TenantContext): Promise<{ data: ConnectedAppView[] }> {
    const rows = await this.grants.listActive(ctx.userId, ctx.workspaceId);
    return {
      data: rows.map(({ grant, client }) => ({
        id: grant.id,
        name: client.name,
        kind: client.kind,
        clientUri: client.clientUri,
        scopes: grant.scopes,
        connectedAt: grant.createdAt.toISOString(),
        lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  async disconnect(ctx: TenantContext, grantId: string): Promise<void> {
    const grant = await this.grants.findById(grantId);
    if (
      !grant ||
      grant.revokedAt ||
      grant.workspaceId !== ctx.workspaceId ||
      grant.userId !== ctx.userId
    ) {
      throw new NotFoundError("This connection doesn't exist.");
    }
    await this.grants.revoke(grant.id);
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "oauth.app_disconnected",
      target: grant.id,
    });
  }
}
