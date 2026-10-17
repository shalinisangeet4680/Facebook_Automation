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

export type AiDraftCounter = (
  workspaceId: string,
  since: Date,
) => Promise<number>;

const DAY = 86_400_000;

@Injectable()
export class WorkspaceAiService {
  private readonly counters = new Map<string, AiDraftCounter>();

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

  async save(
    workspaceId: string,
    values: Partial<typeof workspaceAutomationSettings.$inferInsert>,
  ): Promise<WorkspaceAutomationRow> {
    const [row] = await this.db
      .insert(workspaceAutomationSettings)
      .values({ ...values, workspaceId })
      .onConflictDoUpdate({
        target: workspaceAutomationSettings.workspaceId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  platformAi(): boolean {
    return Boolean(
      this.config.get("ANTHROPIC_API_KEY", { infer: true }) ||
      this.config.get("AI_MOCK", { infer: true }),
    );
  }

  dailyDrafts(): number {
    return this.config.get("AI_DAILY_DRAFTS", { infer: true });
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

  registerDraftCounter(product: string, counter: AiDraftCounter): void {
    this.counters.set(product, counter);
  }

  async draftsToday(workspaceId: string, now = Date.now()): Promise<number> {
    const since = new Date(now - DAY);
    const counts = await Promise.all(
      [...this.counters.values()].map((count) => count(workspaceId, since)),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }

  async allowance(
    workspaceId: string,
    ws: WorkspaceAutomationRow | null,
  ): Promise<number> {
    if ((ws?.aiMode ?? "platform") !== "platform") return Infinity;
    return Math.max(
      0,
      this.dailyDrafts() - (await this.draftsToday(workspaceId)),
    );
  }
}
