import { Inject, Injectable, Logger } from "@nestjs/common";

import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import {
  ESCALATION_NOTIFIER,
  EscalationNotifier,
} from "@modules/engine/domain/ports/notifier";
import { PlayEngine } from "@modules/play/application/play-engine.service";
import { PlayService } from "@modules/play/application/play.service";
import { PlayApiError } from "@modules/play/domain/ports/play-api";
import { PlayAppRow } from "@modules/play/infrastructure/play.tables";

import {
  GUARDIAN_WINDOW_DAYS,
  describeBreach,
  healthByVersion,
  judge,
  previousVersion,
} from "../domain/guardian";
import {
  PLAY_RELEASES_API,
  PlayReleasesApi,
} from "../domain/ports/releases-api";
import {
  TRACK_LABELS,
  applyRollout,
  highestCode,
  liveRelease,
  percent,
  releaseLabel,
  staged,
} from "../domain/rollout";
import { PlayReleasesRepository } from "../infrastructure/play-releases.repository";
import { PlayReleaseGuardianRow } from "../infrastructure/play-releases.tables";
import { PlayReleasesService } from "./play-releases.service";

export const GUARDIAN_EVERY_MS = 30 * 60_000;

export type GuardianStatus = "ok" | "waiting" | "halted" | "idle" | "error";

export interface GuardianOutcome {
  status: GuardianStatus;
  message: string;
  halted: string[];
}

const ACTOR = { userId: null, via: "guardian" } as const;

@Injectable()
export class RolloutGuardian {
  private readonly logger = new Logger(RolloutGuardian.name);

  constructor(
    private readonly releases: PlayReleasesService,
    private readonly play: PlayService,
    private readonly engine: PlayEngine,
    private readonly repo: PlayReleasesRepository,
    @Inject(PLAY_RELEASES_API) private readonly api: PlayReleasesApi,
    @Inject(ESCALATION_NOTIFIER) private readonly notifier: EscalationNotifier,
    private readonly workspaceAi: WorkspaceAiService,
  ) {}

  async tick(now = new Date()) {
    const due = await this.repo.guardiansDue(
      new Date(now.getTime() - GUARDIAN_EVERY_MS),
      50,
    );
    const totals = { checked: 0, halted: 0, failed: 0 };
    for (const { guardian, app } of due) {
      const out = await this.check(app, guardian);
      totals.checked++;
      totals.halted += out.halted.length;
      if (out.status === "error") totals.failed++;
    }
    return totals;
  }

  async checkNow(workspaceId: string, appId: string) {
    const app = await this.play.appRow(workspaceId, appId);
    const guardian = await this.repo.guardian(app.id);
    if (!guardian?.enabled)
      return {
        ...this.releases.guardianView(guardian),
        halted: [] as string[],
      };
    const out = await this.check(app, guardian);
    return {
      ...this.releases.guardianView(await this.repo.guardian(app.id)),
      halted: out.halted,
    };
  }

  async check(
    app: PlayAppRow,
    guardian: PlayReleaseGuardianRow,
  ): Promise<GuardianOutcome> {
    let out: GuardianOutcome;
    try {
      out = await this.evaluate(app, guardian);
    } catch (err) {
      const message =
        err instanceof PlayApiError
          ? err.message
          : "The rollout couldn't be checked.";
      if (!(err instanceof PlayApiError))
        this.logger.warn(
          `Guardian failed for ${app.packageName}: ${(err as Error).message}`,
        );
      out = { status: "error", message, halted: [] };
    }
    await this.repo.updateGuardian(app.id, {
      lastCheckedAt: new Date(),
      lastStatus: out.status,
      lastMessage: out.message,
    });
    return out;
  }

  private async evaluate(
    app: PlayAppRow,
    guardian: PlayReleaseGuardianRow,
  ): Promise<GuardianOutcome> {
    const key = await this.engine.keyFor(app);
    const tracks = await this.api.listTracks(key, app.packageName);
    const rolling = tracks
      .map((track) => ({ track, release: staged(track) }))
      .filter((x) => x.release?.status === "inProgress");
    if (!rolling.length)
      return {
        status: "idle",
        message: "No staged rollout is in progress.",
        halted: [],
      };
    const [crash, anr] = await Promise.all([
      this.api.vitals(key, app.packageName, "crash", GUARDIAN_WINDOW_DAYS),
      this.api.vitals(key, app.packageName, "anr", GUARDIAN_WINDOW_DAYS),
    ]);
    const since = new Date(Date.now() - GUARDIAN_WINDOW_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const health = healthByVersion(crash, anr, since);
    const messages: string[] = [];
    const halted: string[] = [];
    let waiting = false;
    for (const { track, release } of rolling) {
      const code = String(highestCode(release!));
      const label = `${releaseLabel(release!)} on ${TRACK_LABELS[track.track] ?? track.track}`;
      if (guardian.ignoredVersion === code) {
        messages.push(`${label}: skipped because you resumed it after a halt.`);
        continue;
      }
      const live = liveRelease(track);
      const verdict = judge(
        guardian,
        health.get(code) ?? null,
        previousVersion(health, code, live ? String(highestCode(live)) : null),
      );
      if (verdict.action === "wait") {
        waiting = true;
        messages.push(`${label}: ${verdict.reason}`);
        continue;
      }
      if (verdict.action === "ok") {
        messages.push(
          `${label}: healthy at ${percent(release!.userFraction)}%.`,
        );
        continue;
      }
      const plan = applyRollout(track, "halt");
      if (!plan.ok) continue;
      await this.api.updateTrack(key, app.packageName, plan.value.track);
      const reasons = verdict.breaches.map(describeBreach);
      const message = `Halted ${label} at ${percent(release!.userFraction)}%: ${reasons.join("; ")}.`;
      halted.push(code);
      messages.push(message);
      await this.releases.record(
        { ...ACTOR, workspaceId: app.workspaceId },
        app,
        "auto_halted",
        { track: track.track, versionCodes: release!.versionCodes },
        message,
        { breaches: verdict.breaches },
      );
      await this.alert(
        app,
        `Rollout halted: ${app.title} ${releaseLabel(release!)}`,
        message,
      );
    }
    return {
      status: halted.length ? "halted" : waiting ? "waiting" : "ok",
      message: messages.join(" "),
      halted,
    };
  }

  private async alert(app: PlayAppRow, title: string, text: string) {
    const webhook = this.workspaceAi.slackWebhook(
      await this.workspaceAi.settings(app.workspaceId),
    );
    if (!webhook) return;
    try {
      await this.notifier.alert(webhook, {
        title,
        text,
        url: this.releases.releasesUrl(app.id),
      });
    } catch (err) {
      this.logger.warn(`Guardian alert failed: ${(err as Error).message}`);
    }
  }
}
