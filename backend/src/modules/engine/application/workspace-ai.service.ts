import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";

import { AppConfig } from "@shared/config/app-config";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { CryptoService } from "@shared/security/crypto.service";

import {
  WorkspaceAutomationRow,
  workspaceAutomationSettings,
} from "../infrastructure/engine.tables";

@Injectable()
export class WorkspaceAiService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly crypto: CryptoService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  async settings(workspaceId: string): Promise<WorkspaceAutomationRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(workspaceAutomationSettings)
        .where(eq(workspaceAutomationSettings.workspaceId, workspaceId))
        .limit(1),
    );
  }

  keyFrom(ws: WorkspaceAutomationRow | null): string | null {
    const mode = ws?.aiMode ?? "platform";
    if (mode === "off") return null;
    if (mode === "own")
      return ws?.aiKeyCiphertext
        ? this.crypto.decrypt(ws.aiKeyCiphertext)
        : null;
    if (this.config.get("AI_MOCK", { infer: true })) return "mock";
    return this.config.get("ANTHROPIC_API_KEY", { infer: true }) ?? null;
  }

  slackWebhook(ws: WorkspaceAutomationRow | null): string | null {
    return ws?.slackWebhookCiphertext
      ? this.crypto.decrypt(ws.slackWebhookCiphertext)
      : null;
  }

  allowance(ws: WorkspaceAutomationRow | null, usedToday: number): number {
    if ((ws?.aiMode ?? "platform") !== "platform") return Infinity;
    return this.config.get("AI_DAILY_DRAFTS", { infer: true }) - usedToday;
  }
}
