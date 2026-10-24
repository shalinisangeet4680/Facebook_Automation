import { Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import {
  AGENT_PERMISSIONS,
  AI_MODES,
  AgentPermission,
  AgentPermissions,
  AiMode,
  agentPermissions,
} from "@modules/engine/domain/engine.types";
import { REPLY_MODEL } from "@modules/engine/infrastructure/anthropic-reply.ai";
import { WorkspaceAutomationRow } from "@modules/engine/infrastructure/engine.tables";
import { ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

export interface AutomationActor {
  userId: string | null;
  workspaceId: string;
  via: string;
}

export interface AutomationUpdate {
  aiMode?: AiMode;
  aiKey?: string | null;
  slackWebhook?: string | null;
  slackChannel?: string | null;
  agentsCanPost?: boolean;
  agentPermissions?: Partial<AgentPermissions>;
  notifyNewLeads?: boolean;
}

export interface AutomationSettingsView {
  aiMode: AiMode;
  platformAi: boolean;
  aiKeyHint: string | null;
  aiReady: boolean;
  model: string;
  dailyDrafts: number;
  draftsToday: number;
  slackConnected: boolean;
  slackChannel: string | null;
  agentsCanPost: boolean;
  agentPermissions: AgentPermissions;
  notifyNewLeads: boolean;
}

@Injectable()
export class AutomationSettingsService {
  constructor(
    private readonly workspaceAi: WorkspaceAiService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  view(
    ws: WorkspaceAutomationRow | null,
    draftsToday: number,
  ): AutomationSettingsView {
    return {
      aiMode: ws?.aiMode ?? "platform",
      platformAi: this.workspaceAi.platformAi(),
      aiKeyHint: ws?.aiKeyHint ?? null,
      aiReady: Boolean(this.workspaceAi.keyFrom(ws)),
      model: REPLY_MODEL,
      dailyDrafts: this.workspaceAi.dailyDrafts(),
      draftsToday,
      slackConnected: Boolean(ws?.slackWebhookCiphertext),
      slackChannel: ws?.slackChannel ?? null,
      agentsCanPost: ws?.agentsCanPost ?? false,
      agentPermissions: agentPermissions(ws?.agentPermissions),
      notifyNewLeads: ws?.notifyNewLeads ?? true,
    };
  }

  async get(workspaceId: string): Promise<AutomationSettingsView> {
    const [ws, used] = await Promise.all([
      this.workspaceAi.settings(workspaceId),
      this.workspaceAi.draftsToday(workspaceId),
    ]);
    return this.view(ws, used);
  }

  async update(
    actor: AutomationActor,
    input: AutomationUpdate,
  ): Promise<AutomationSettingsView> {
    const values: Partial<WorkspaceAutomationRow> = {};
    if (input.aiMode !== undefined) {
      if (!AI_MODES.includes(input.aiMode))
        throw new ValidationError("Choose platform, own or off.");
      values.aiMode = input.aiMode;
    }
    if (input.aiKey !== undefined) {
      if (input.aiKey === null || !input.aiKey.trim()) {
        values.aiKeyCiphertext = null;
        values.aiKeyHint = null;
      } else {
        const key = input.aiKey.trim();
        if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key))
          throw new ValidationError(
            "Paste an Anthropic API key that starts with sk-ant-.",
          );
        values.aiKeyCiphertext = this.crypto.encrypt(key);
        values.aiKeyHint = `sk-ant-…${key.slice(-4)}`;
      }
    }
    if (input.slackWebhook !== undefined) {
      if (input.slackWebhook === null || !input.slackWebhook.trim())
        values.slackWebhookCiphertext = null;
      else {
        const url = input.slackWebhook.trim();
        if (
          !/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/.test(url)
        )
          throw new ValidationError(
            "Use a Slack incoming webhook URL that starts with https://hooks.slack.com/services/.",
          );
        values.slackWebhookCiphertext = this.crypto.encrypt(url);
      }
    }
    if (input.slackChannel !== undefined) {
      const channel = input.slackChannel?.trim().replace(/^#?/, "#") ?? null;
      if (channel && !/^#[a-z0-9_-]{1,80}$/.test(channel))
        throw new ValidationError("Channel names look like #support.");
      values.slackChannel = channel && channel !== "#" ? channel : null;
    }
    if (input.agentsCanPost !== undefined)
      values.agentsCanPost = input.agentsCanPost;
    if (input.agentPermissions !== undefined) {
      const changes = Object.entries(input.agentPermissions).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      );
      if (
        changes.some(([k]) => !AGENT_PERMISSIONS.includes(k as AgentPermission))
      )
        throw new ValidationError("Unknown AI permission.");
      const current = await this.workspaceAi.settings(actor.workspaceId);
      values.agentPermissions = {
        ...agentPermissions(current?.agentPermissions),
        ...Object.fromEntries(changes),
      };
    }
    if (input.notifyNewLeads !== undefined)
      values.notifyNewLeads = input.notifyNewLeads;
    const fields = (Object.keys(input) as (keyof AutomationUpdate)[]).filter(
      (k) => input[k] !== undefined,
    );
    if (fields.length) {
      await this.workspaceAi.save(actor.workspaceId, values);
      await this.audit.record({
        workspaceId: actor.workspaceId,
        actor: actor.userId ? "user" : "system",
        actorId: actor.userId,
        action: "automation.settings_updated",
        target: actor.workspaceId,
        data: { fields, via: actor.via },
      });
    }
    return this.get(actor.workspaceId);
  }
}
