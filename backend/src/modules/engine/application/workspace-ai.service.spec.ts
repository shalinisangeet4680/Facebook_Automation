import { AppConfig } from "@shared/config/app-config";
import { Database } from "@shared/database/database";
import { CryptoService } from "@shared/security/crypto.service";

import { WorkspaceAutomationRow } from "../infrastructure/engine.tables";
import { WorkspaceAiService } from "./workspace-ai.service";

const config = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as unknown as AppConfig;

const service = (daily = 10) =>
  new WorkspaceAiService(
    {} as Database,
    {} as CryptoService,
    config({ AI_DAILY_DRAFTS: daily, AI_MOCK: true }),
  );

const mode = (aiMode: WorkspaceAutomationRow["aiMode"]) =>
  ({ aiMode }) as WorkspaceAutomationRow;

describe("WorkspaceAiService draft quota", () => {
  it("adds AI drafts from every registered product", async () => {
    const ai = service();
    const seen: [string, number][] = [];
    ai.registerDraftCounter("play", (id, since) => {
      seen.push([id, since.getTime()]);
      return Promise.resolve(3);
    });
    ai.registerDraftCounter("business", () => Promise.resolve(4));
    const now = Date.UTC(2026, 9, 17, 12);
    expect(await ai.draftsToday("ws-1", now)).toBe(7);
    expect(seen).toEqual([["ws-1", now - 86_400_000]]);
  });

  it("shares one daily allowance across products", async () => {
    const ai = service(10);
    ai.registerDraftCounter("play", () => Promise.resolve(6));
    ai.registerDraftCounter("business", () => Promise.resolve(3));
    expect(await ai.allowance("ws-1", null)).toBe(1);
    ai.registerDraftCounter("business", () => Promise.resolve(8));
    expect(await ai.allowance("ws-1", mode("platform"))).toBe(0);
  });

  it("does not cap workspaces on their own key or with AI off", async () => {
    const ai = service(1);
    ai.registerDraftCounter("play", () => Promise.resolve(50));
    expect(await ai.allowance("ws-1", mode("own"))).toBe(Infinity);
    expect(await ai.allowance("ws-1", mode("off"))).toBe(Infinity);
  });

  it("counts nothing before any product registers", async () => {
    expect(await service().draftsToday("ws-1")).toBe(0);
  });
});
