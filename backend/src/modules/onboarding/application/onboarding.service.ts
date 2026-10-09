import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import {
  META_EVENTS,
  MetaConnectedEvent,
} from "@modules/meta/domain/meta.types";

import {
  buildView,
  OnboardingStepId,
  OnboardingView,
} from "../domain/onboarding.steps";
import { OnboardingRepository } from "../infrastructure/onboarding.repository";

const REQUIRED_PRIMARY = ["ad_account", "page"] as const;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly progress: OnboardingRepository,
    private readonly meta: MetaConnectionService,
  ) {}

  async view(workspaceId: string): Promise<OnboardingView> {
    const [rows, meta] = await Promise.all([
      this.progress.list(workspaceId),
      this.meta.setupState(workspaceId),
    ]);
    const stored = new Map(
      rows
        .filter((r) => r.status === "completed")
        .map((r) => [r.step as OnboardingStepId, r.completedAt]),
    );
    const completed = new Map<OnboardingStepId, Date | null>();
    completed.set("sign_in", null);
    if (meta.connected) {
      completed.set("connect_meta", stored.get("connect_meta") ?? null);
      if (REQUIRED_PRIMARY.every((k) => meta.primaryKinds.includes(k))) {
        completed.set("choose_assets", stored.get("choose_assets") ?? null);
      }
    }
    for (const [step, at] of stored) {
      if (step !== "connect_meta" && step !== "choose_assets") {
        completed.set(step, at);
      }
    }
    return buildView(completed);
  }

  @OnEvent(META_EVENTS.CONNECTED)
  onMetaConnected(event: MetaConnectedEvent): Promise<void> {
    return this.safely("connect_meta", async () => {
      await this.progress.complete(event.workspaceId, "connect_meta");
      await this.syncAssetStep(event.workspaceId);
    });
  }

  @OnEvent(META_EVENTS.ASSETS_SELECTED)
  onAssetsSelected(event: MetaConnectedEvent): Promise<void> {
    return this.safely("choose_assets", () =>
      this.syncAssetStep(event.workspaceId),
    );
  }

  @OnEvent(META_EVENTS.DISCONNECTED)
  onMetaDisconnected(event: MetaConnectedEvent): Promise<void> {
    return this.safely("reset", () =>
      this.progress.reset(event.workspaceId, ["connect_meta", "choose_assets"]),
    );
  }

  private async safely(label: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (err) {
      this.logger.error(
        `Onboarding update failed (${label})`,
        (err as Error).stack,
      );
    }
  }

  private async syncAssetStep(workspaceId: string): Promise<void> {
    const meta = await this.meta.setupState(workspaceId);
    if (REQUIRED_PRIMARY.every((k) => meta.primaryKinds.includes(k))) {
      await this.progress.complete(workspaceId, "choose_assets");
    }
  }
}
