import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { GrantService } from "@modules/oauth/application/grant.service";
import { AuditService } from "@modules/audit/application/audit.service";
import { AppConfig, mcpResourceUrl } from "@shared/config/app-config";
import { NotFoundError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";
import { TenantContext } from "@shared/tenant/tenant-context";

import {
  AutomationSettingsService,
  AutomationUpdate,
} from "@modules/automation/application/automation-settings.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { PlayActor, PlayEngine } from "./play-engine.service";

export const TOKEN_PREFIX = "rk_live_";
const ROTATE_GRACE_MS = 10 * 60_000;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const maskToken = (token: string) =>
  `${token.slice(0, 8)}••••••••••${token.slice(-3)}`;

export type WorkspaceUpdate = AutomationUpdate;

@Injectable()
export class PlayWorkspaceService {
  constructor(
    private readonly engine: PlayEngine,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly grants: GrantService,
    private readonly automation: AutomationSettingsService,
    private readonly workspaceAi: WorkspaceAiService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private record(actor: PlayActor, action: string, data = {}) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: actor.userId ? "user" : "system",
      actorId: actor.userId,
      action,
      target: actor.workspaceId,
      data: { ...data, via: actor.via },
    });
  }

  async get(workspaceId: string) {
    const [ws, apps, connections, used] = await Promise.all([
      this.repo.workspaceSettings(workspaceId),
      this.repo.apps(workspaceId),
      this.repo.connections(workspaceId),
      this.workspaceAi.draftsToday(workspaceId),
    ]);
    const token = ws?.tokenCiphertext
      ? this.crypto.decrypt(ws.tokenCiphertext)
      : null;
    return {
      ...this.automation.view(ws, used),
      mcpUrl: mcpResourceUrl(this.config),
      token: token ? maskToken(token) : null,
      tokenCreatedAt: ws?.tokenCreatedAt?.toISOString() ?? null,
      apps: apps.length,
      connected: connections.length > 0,
    };
  }

  async update(actor: PlayActor, input: WorkspaceUpdate) {
    await this.automation.update(actor, input);
    return this.get(actor.workspaceId);
  }

  async reveal(actor: PlayActor) {
    const ws = await this.repo.workspaceSettings(actor.workspaceId);
    if (ws?.tokenCiphertext)
      return { token: this.crypto.decrypt(ws.tokenCiphertext) };
    return this.rotate(actor);
  }

  async rotate(actor: PlayActor) {
    const ws = await this.repo.workspaceSettings(actor.workspaceId);
    const token = `${TOKEN_PREFIX}${randomBytes(18).toString("hex")}`;
    await this.repo.saveWorkspaceSettings(actor.workspaceId, {
      tokenHash: hash(token),
      tokenCiphertext: this.crypto.encrypt(token),
      tokenUserId: actor.userId,
      tokenCreatedAt: new Date(),
      tokenLastUsedAt: null,
      tokenLastTool: null,
      previousTokenHash: ws?.tokenHash ?? null,
      previousTokenExpiresAt: ws?.tokenHash
        ? new Date(Date.now() + ROTATE_GRACE_MS)
        : null,
    });
    await this.record(
      actor,
      ws?.tokenHash ? "play.token_rotated" : "play.token_created",
    );
    return { token };
  }

  async revokeToken(actor: PlayActor) {
    await this.repo.saveWorkspaceSettings(actor.workspaceId, {
      tokenHash: null,
      tokenCiphertext: null,
      tokenLastUsedAt: null,
      tokenLastTool: null,
      previousTokenHash: null,
      previousTokenExpiresAt: null,
    });
    await this.record(actor, "play.token_revoked");
  }

  async authenticate(token: string) {
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const ws = await this.repo.settingsByToken(hash(token), new Date());
    if (!ws?.tokenUserId) return null;
    return { workspaceId: ws.workspaceId, userId: ws.tokenUserId };
  }

  async touchToken(workspaceId: string, tool: string | null) {
    await this.repo.saveWorkspaceSettings(workspaceId, {
      tokenLastUsedAt: new Date(),
      ...(tool ? { tokenLastTool: tool } : {}),
    });
  }

  async agentsCanPost(workspaceId: string) {
    return (
      (await this.repo.workspaceSettings(workspaceId))?.agentsCanPost ?? false
    );
  }

  async clients(ctx: TenantContext) {
    const [grants, ws] = await Promise.all([
      this.grants.list(ctx),
      this.repo.workspaceSettings(ctx.workspaceId),
    ]);
    return {
      data: [
        ...(ws?.tokenHash
          ? [
              {
                id: "token",
                name: "Access token",
                kind: "token" as const,
                lastUsedAt: ws.tokenLastUsedAt?.toISOString() ?? null,
                lastTool: ws.tokenLastTool,
                connectedAt: ws.tokenCreatedAt?.toISOString() ?? null,
              },
            ]
          : []),
        ...grants.data.map((g) => ({
          id: g.id,
          name: g.name,
          kind: "oauth" as const,
          lastUsedAt: g.lastUsedAt,
          lastTool: null as string | null,
          connectedAt: g.connectedAt,
        })),
      ],
    };
  }

  async revokeClient(ctx: TenantContext, id: string) {
    if (id === "token")
      return this.revokeToken({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        via: "app",
      });
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new NotFoundError("This connection doesn't exist.");
    await this.grants.disconnect(ctx, id);
  }
}
