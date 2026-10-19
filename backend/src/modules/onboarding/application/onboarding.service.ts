import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { AdsService } from "@modules/ads/application/ads.service";
import { Goal } from "@modules/ads/domain/goals";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import {
  META_EVENTS,
  MetaConnectedEvent,
} from "@modules/meta/domain/meta.types";
import { PlanService } from "@modules/plans/application/plan.service";
import { SettingsService } from "@modules/settings/application/settings.service";
import { ValidationError } from "@shared/errors/domain-error";

import {
  buildView,
  completedSteps,
  goalNeedsTracking,
  OnboardingStepId,
  OnboardingView,
  REQUIRED_PRIMARY,
  SKIPPABLE_STEPS,
  STEPS,
} from "../domain/onboarding.steps";
import { OnboardingRepository } from "../infrastructure/onboarding.repository";

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly progress: OnboardingRepository,
    private readonly meta: MetaConnectionService,
    private readonly settings: SettingsService,
    private readonly ads: AdsService,
    private readonly plans: PlanService,
  ) {}

  async view(workspaceId: string): Promise<OnboardingView> {
    const [rows, meta, profile, plans] = await Promise.all([
      this.progress.list(workspaceId),
      this.meta.setupState(workspaceId),
      this.settings.profile(workspaceId),
      this.plans.progress(workspaceId),
    ]);
    const stored = new Map(
      rows.map((r) => [r.step as OnboardingStepId, r] as const),
    );
    const skipped = new Set(
      rows
        .filter((r) => r.status === "skipped")
        .map((r) => r.step as OnboardingStepId),
    );
    const trackingReady =
      meta.connected && goalNeedsTracking(profile.goal)
        ? await this.trackingReady(workspaceId, profile.goal!)
        : false;
    const done = completedSteps({
      metaConnected: meta.connected,
      primaryKinds: meta.primaryKinds,
      basicsComplete: profile.basicsComplete,
      goal: profile.goal,
      budgetSet: profile.budgetSet,
      trackingReady,
      plans,
    });
    const completed = new Map<OnboardingStepId, Date | null>();
    for (const id of done) {
      const row = stored.get(id);
      completed.set(
        id,
        row?.status === "completed" ? (row.completedAt ?? null) : null,
      );
    }
    return buildView(completed, skipped, profile.goal);
  }

  async skip(workspaceId: string, step: string): Promise<OnboardingView> {
    const known = STEPS.find((s) => s.id === step);
    if (!known || !SKIPPABLE_STEPS.includes(known.id)) {
      throw new ValidationError("This step can't be skipped.");
    }
    await this.progress.skip(workspaceId, known.id);
    return this.view(workspaceId);
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

  private async trackingReady(workspaceId: string, goal: Goal) {
    try {
      const report = await this.ads.tracking(workspaceId);
      return report.goals.find((g) => g.goal === goal)?.ready ?? false;
    } catch (err) {
      this.logger.warn(
        `Tracking check unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
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
