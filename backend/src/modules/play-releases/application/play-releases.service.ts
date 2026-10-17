import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuditService } from "@modules/audit/application/audit.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { RELEASE_AI, ReleaseAi } from "@modules/engine/domain/ports/release-ai";
import { ReplyAiError } from "@modules/engine/domain/ports/reply-ai";
import {
  PlayActor,
  PlayEngine,
} from "@modules/play/application/play-engine.service";
import { PlayService } from "@modules/play/application/play.service";
import { PlayApiError } from "@modules/play/domain/ports/play-api";
import { PlayAppRow } from "@modules/play/infrastructure/play.tables";
import { AppConfig, appUrl } from "@shared/config/app-config";
import { ErrorCode } from "@shared/errors/error-codes";
import {
  CodedError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";

import {
  DEFAULT_GUARDIAN,
  GOOGLE_THRESHOLDS,
  GuardianSettings,
  dailyRates,
  healthByVersion,
  validGuardian,
} from "../domain/guardian";
import {
  IssueType,
  PLAY_RELEASES_API,
  PlayReleasesApi,
  ReleaseData,
  ReleaseNote,
  TrackData,
} from "../domain/ports/releases-api";
import {
  NOTE_MAX,
  PromoteMode,
  Result,
  RolloutAction,
  TRACK_LABELS,
  applyRollout,
  highestCode,
  percent,
  promote,
  releaseLabel,
  setNotes,
  sortTracks,
  staged,
  trackKind,
} from "../domain/rollout";
import { likelyFiles } from "../domain/stack-files";
import { PlayReleasesRepository } from "../infrastructure/play-releases.repository";
import {
  PlayReleaseEventRow,
  PlayReleaseGuardianRow,
} from "../infrastructure/play-releases.tables";

export interface RolloutInput {
  track: string;
  action: RolloutAction;
  fraction?: number;
}

export interface PromoteInput {
  fromTrack: string;
  toTrack: string;
  versionCodes?: string[];
  mode: PromoteMode;
  fraction?: number;
}

export interface NotesInput {
  track: string;
  versionCode: string;
  notes: ReleaseNote[];
}

export const HEALTH_DAYS = [7, 14, 28] as const;

export function googleError(err: unknown): never {
  if (!(err instanceof PlayApiError)) throw err;
  if (err.kind === "not_found") throw new NotFoundError(err.message);
  if (err.kind === "unavailable" || err.kind === "quota")
    throw new CodedError(ErrorCode.SERVICE_UNAVAILABLE, 503, err.message);
  throw new ValidationError(err.message, { reason: err.kind });
}

const ROLLOUT_EVENT: Record<RolloutAction, string> = {
  increase: "increased",
  halt: "halted",
  resume: "resumed",
  complete: "completed",
};

const actorKind = (actor: PlayActor) =>
  actor.via === "guardian"
    ? "guardian"
    : actor.via.startsWith("mcp:")
      ? "claude"
      : "user";

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new ValidationError(r.problem);
  return r.value;
};

@Injectable()
export class PlayReleasesService {
  constructor(
    private readonly play: PlayService,
    private readonly engine: PlayEngine,
    private readonly repo: PlayReleasesRepository,
    @Inject(PLAY_RELEASES_API) readonly api: PlayReleasesApi,
    @Inject(RELEASE_AI) private readonly ai: ReleaseAi,
    private readonly workspaceAi: WorkspaceAiService,
    private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  releasesUrl(appId: string) {
    return `${appUrl(this.config)}/reviews/releases?app=${appId}`;
  }

  healthUrl(appId: string) {
    return `${appUrl(this.config)}/reviews/health?app=${appId}`;
  }

  async context(workspaceId: string, appId: string) {
    const app = await this.play.appRow(workspaceId, appId);
    if (app.archivedAt)
      throw new ValidationError(
        "TreeVook lost access to this app on Google Play. Restore access, then sync it again.",
      );
    return { app, key: await this.engine.keyFor(app) };
  }

  async google<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      googleError(err);
    }
  }

  trackView(t: TrackData) {
    return {
      track: t.track,
      label: TRACK_LABELS[t.track] ?? t.track,
      kind: trackKind(t.track),
      releases: [...t.releases]
        .sort((a, b) => highestCode(b) - highestCode(a))
        .map((r) => this.releaseView(r)),
    };
  }

  releaseView(r: ReleaseData) {
    return {
      name: r.name,
      versionCodes: r.versionCodes,
      status: r.status,
      userFraction: r.userFraction,
      rolloutPercent: r.status === "completed" ? 100 : percent(r.userFraction),
      notes: r.releaseNotes,
    };
  }

  guardianView(row: PlayReleaseGuardianRow | null) {
    return {
      enabled: row?.enabled ?? DEFAULT_GUARDIAN.enabled,
      maxCrashRate: row?.maxCrashRate ?? DEFAULT_GUARDIAN.maxCrashRate,
      maxAnrRate: row?.maxAnrRate ?? DEFAULT_GUARDIAN.maxAnrRate,
      minUsers: row?.minUsers ?? DEFAULT_GUARDIAN.minUsers,
      defaults: {
        maxCrashRate: DEFAULT_GUARDIAN.maxCrashRate,
        maxAnrRate: DEFAULT_GUARDIAN.maxAnrRate,
        minUsers: DEFAULT_GUARDIAN.minUsers,
      },
      ignoredVersion: row?.ignoredVersion ?? null,
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      lastStatus: row?.lastStatus ?? null,
      lastMessage: row?.lastMessage ?? null,
    };
  }

  eventView(e: PlayReleaseEventRow) {
    return {
      id: e.id,
      kind: e.kind,
      track: e.track,
      versionCodes: e.versionCodes,
      message: e.message,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    };
  }

  async overview(workspaceId: string, appId: string) {
    const { app, key } = await this.context(workspaceId, appId);
    const [tracks, languages, guardian, events] = await Promise.all([
      this.google(() => this.api.listTracks(key, app.packageName)),
      this.google(() => this.api.listingLanguages(key, app.packageName)),
      this.repo.guardian(app.id),
      this.repo.events(app.id, 20),
    ]);
    return {
      app: {
        id: app.id,
        title: app.title,
        packageName: app.packageName,
        iconUrl: app.iconUrl,
      },
      tracks: sortTracks(tracks).map((t) => this.trackView(t)),
      languages,
      noteMax: NOTE_MAX,
      guardian: this.guardianView(guardian),
      events: events.map((e) => this.eventView(e)),
    };
  }

  private async track(
    app: PlayAppRow,
    key: Awaited<ReturnType<PlayEngine["keyFor"]>>,
    name: string,
  ): Promise<TrackData> {
    const tracks = await this.google(() =>
      this.api.listTracks(key, app.packageName),
    );
    const found = tracks.find((t) => t.track === name);
    if (!found)
      throw new NotFoundError(
        `${app.title} has no ${name} track on Google Play.`,
      );
    return found;
  }

  async record(
    actor: PlayActor,
    app: PlayAppRow,
    kind: string,
    release: { track: string; versionCodes: string[] },
    message: string,
    data: Record<string, unknown> = {},
  ) {
    const row = await this.repo.addEvent({
      workspaceId: app.workspaceId,
      appId: app.id,
      kind,
      track: release.track,
      versionCodes: release.versionCodes,
      message,
      actor: actorKind(actor),
      actorId: actor.userId,
      data,
    });
    await this.audit.record({
      workspaceId: app.workspaceId,
      actor: actor.userId ? "user" : "system",
      actorId: actor.userId,
      action: `play.release_${kind}`,
      target: app.id,
      data: {
        ...data,
        track: release.track,
        versionCodes: release.versionCodes,
        message,
        via: actor.via,
      },
    });
    return row;
  }

  async previewRollout(
    workspaceId: string,
    appId: string,
    input: RolloutInput,
  ) {
    const { app, key } = await this.context(workspaceId, appId);
    const current = await this.track(app, key, input.track);
    const out = unwrap(applyRollout(current, input.action, input.fraction));
    return { app, key, current, ...out };
  }

  async rollout(actor: PlayActor, appId: string, input: RolloutInput) {
    const { app, key, current, track, release, summary } =
      await this.previewRollout(actor.workspaceId, appId, input);
    const before = staged(current);
    const updated = await this.google(() =>
      this.api.updateTrack(key, app.packageName, track),
    );
    if (
      before?.status === "halted" &&
      (input.action === "resume" || input.action === "increase")
    ) {
      const guardian = await this.repo.guardian(app.id);
      if (guardian?.enabled)
        await this.repo.updateGuardian(app.id, {
          ignoredVersion: String(highestCode(release)),
        });
    }
    await this.record(
      actor,
      app,
      ROLLOUT_EVENT[input.action],
      { track: track.track, versionCodes: release.versionCodes },
      summary,
      { from: before?.userFraction ?? null, to: release.userFraction },
    );
    return { summary, track: this.trackView(updated) };
  }

  async previewPromote(
    workspaceId: string,
    appId: string,
    input: PromoteInput,
  ) {
    const { app, key } = await this.context(workspaceId, appId);
    const tracks = await this.google(() =>
      this.api.listTracks(key, app.packageName),
    );
    const from = tracks.find((t) => t.track === input.fromTrack);
    if (!from)
      throw new NotFoundError(`${app.title} has no ${input.fromTrack} track.`);
    const to = tracks.find((t) => t.track === input.toTrack) ?? {
      track: input.toTrack,
      releases: [],
    };
    return { app, key, ...unwrap(promote(from, to, input)) };
  }

  async promote(actor: PlayActor, appId: string, input: PromoteInput) {
    const { app, key, track, release, summary } = await this.previewPromote(
      actor.workspaceId,
      appId,
      input,
    );
    const updated = await this.google(() =>
      this.api.updateTrack(key, app.packageName, track),
    );
    await this.record(
      actor,
      app,
      "promoted",
      { track: track.track, versionCodes: release.versionCodes },
      summary,
      { from: input.fromTrack, mode: input.mode },
    );
    return { summary, track: this.trackView(updated) };
  }

  async saveNotes(actor: PlayActor, appId: string, input: NotesInput) {
    const { app, key } = await this.context(actor.workspaceId, appId);
    const track = await this.track(app, key, input.track);
    const { track: next, release } = unwrap(
      setNotes(track, input.versionCode, input.notes),
    );
    const updated = await this.google(() =>
      this.api.updateTrack(key, app.packageName, next),
    );
    await this.record(
      actor,
      app,
      "notes_saved",
      { track: track.track, versionCodes: release.versionCodes },
      `Update release notes for ${releaseLabel(release)} in ${release.releaseNotes.map((n) => n.language).join(", ") || "no languages"}`,
    );
    return { summary: "Release notes saved.", track: this.trackView(updated) };
  }

  private async aiKey(workspaceId: string) {
    const key = this.workspaceAi.keyFrom(
      await this.workspaceAi.settings(workspaceId),
    );
    if (!key)
      throw new ValidationError(
        "AI is turned off for this workspace. Turn on AI drafting on the Play Reviews MCP page.",
      );
    return key;
  }

  private async withAi<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ReplyAiError)
        throw new CodedError(ErrorCode.SERVICE_UNAVAILABLE, 503, err.message);
      throw err;
    }
  }

  async draftNotes(
    workspaceId: string,
    appId: string,
    input: { changelog: string; versionName?: string; languages?: string[] },
  ) {
    const { app, key } = await this.context(workspaceId, appId);
    const listing = await this.google(() =>
      this.api.listingLanguages(key, app.packageName),
    );
    const languages = input.languages?.length
      ? input.languages
      : listing.length
        ? listing
        : ["en-US"];
    const aiKey = await this.aiKey(workspaceId);
    const notes = await this.withAi(() =>
      this.ai.releaseNotes(aiKey, {
        appName: app.title,
        versionName: input.versionName ?? null,
        changelog: input.changelog,
        languages,
        maxLength: NOTE_MAX,
      }),
    );
    return {
      languages,
      noteMax: NOTE_MAX,
      notes: notes.map((n) => ({
        language: n.language,
        text: n.text,
        length: n.text.length,
      })),
    };
  }

  async guardian(workspaceId: string, appId: string) {
    const app = await this.play.appRow(workspaceId, appId);
    return this.guardianView(await this.repo.guardian(app.id));
  }

  async updateGuardian(
    actor: PlayActor,
    appId: string,
    input: Partial<GuardianSettings>,
  ) {
    const app = await this.play.appRow(actor.workspaceId, appId);
    const current = this.guardianView(await this.repo.guardian(app.id));
    const next: GuardianSettings = {
      enabled: input.enabled ?? current.enabled,
      maxCrashRate: input.maxCrashRate ?? current.maxCrashRate,
      maxAnrRate: input.maxAnrRate ?? current.maxAnrRate,
      minUsers: input.minUsers ?? current.minUsers,
    };
    const problem = validGuardian(next);
    if (problem) throw new ValidationError(problem);
    const row = await this.repo.saveGuardian({
      appId: app.id,
      workspaceId: app.workspaceId,
      ...next,
    });
    await this.audit.record({
      workspaceId: app.workspaceId,
      actor: actor.userId ? "user" : "system",
      actorId: actor.userId,
      action: "play.release_guardian_updated",
      target: app.id,
      data: { ...next, via: actor.via },
    });
    return this.guardianView(row);
  }

  async health(workspaceId: string, appId: string, days: number) {
    const { app, key } = await this.context(workspaceId, appId);
    const [crash, anr, guardian, tracks] = await Promise.all([
      this.google(() => this.api.vitals(key, app.packageName, "crash", days)),
      this.google(() => this.api.vitals(key, app.packageName, "anr", days)),
      this.repo.guardian(app.id),
      this.google(() => this.api.listTracks(key, app.packageName)),
    ]);
    const settings = this.guardianView(guardian);
    const since = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const versions = [...healthByVersion(crash, anr, since).values()].sort(
      (a, b) => Number(b.versionCode) - Number(a.versionCode),
    );
    const names = new Map<string, string>();
    for (const t of tracks)
      for (const r of t.releases)
        for (const c of r.versionCodes) if (r.name) names.set(c, r.name);
    const rollouts = tracks
      .map((t) => ({ t, r: staged(t) }))
      .filter((x): x is { t: TrackData; r: ReleaseData } => Boolean(x.r))
      .map(({ t, r }) => ({
        track: t.track,
        label: TRACK_LABELS[t.track] ?? t.track,
        versionCodes: r.versionCodes,
        name: r.name,
        status: r.status,
        rolloutPercent: percent(r.userFraction),
      }));
    return {
      app: { id: app.id, title: app.title, packageName: app.packageName },
      days,
      thresholds: {
        crash: settings.maxCrashRate,
        anr: settings.maxAnrRate,
        googleCrash: GOOGLE_THRESHOLDS.crash,
        googleAnr: GOOGLE_THRESHOLDS.anr,
      },
      crash: dailyRates(crash),
      anr: dailyRates(anr),
      versions: versions.map((v) => ({
        ...v,
        name: names.get(v.versionCode) ?? null,
        overCrash: v.crashRate !== null && v.crashRate > settings.maxCrashRate,
        overAnr: v.anrRate !== null && v.anrRate > settings.maxAnrRate,
      })),
      rollouts,
      guardian: settings,
    };
  }

  async issues(workspaceId: string, appId: string, type: IssueType | null) {
    const { app, key } = await this.context(workspaceId, appId);
    const list = await this.google(() =>
      this.api.errorIssues(key, app.packageName, type),
    );
    return { data: list };
  }

  async issue(workspaceId: string, appId: string, issueId: string) {
    const { app, key } = await this.context(workspaceId, appId);
    const [list, reports] = await Promise.all([
      this.google(() => this.api.errorIssues(key, app.packageName, null)),
      this.google(() => this.api.errorReports(key, app.packageName, issueId)),
    ]);
    const issue = list.find((i) => i.id === issueId);
    if (!issue) throw new NotFoundError("This crash cluster wasn't found.");
    const count = <T>(values: T[]) =>
      [
        ...values.reduce(
          (m, v) => m.set(v, (m.get(v) ?? 0) + 1),
          new Map<T, number>(),
        ),
      ]
        .sort((a, b) => b[1] - a[1])
        .map(([value, n]) => ({ value: String(value), count: n }));
    return {
      app,
      issue,
      reports,
      devices: count(
        reports.map((r) => r.device).filter((d): d is string => Boolean(d)),
      ),
      androidVersions: count(
        reports
          .map((r) => r.androidVersion)
          .filter((v): v is number => v !== null),
      ),
      files: likelyFiles(
        reports.map((r) => r.reportText),
        app.packageName,
      ),
    };
  }

  async issueView(workspaceId: string, appId: string, issueId: string) {
    const { app: _app, ...rest } = await this.issue(
      workspaceId,
      appId,
      issueId,
    );
    return {
      ...rest,
      reports: rest.reports.slice(0, 5),
    };
  }

  async explain(workspaceId: string, appId: string, issueId: string) {
    const detail = await this.issue(workspaceId, appId, issueId);
    const aiKey = await this.aiKey(workspaceId);
    const out = await this.withAi(() =>
      this.ai.explainCrash(aiKey, {
        appName: detail.app.title,
        packageName: detail.app.packageName,
        type: detail.issue.type,
        cause: detail.issue.cause,
        location: detail.issue.location,
        stackTraces: [...new Set(detail.reports.map((r) => r.reportText))],
        devices: detail.devices.map((d) => d.value),
        androidVersions: detail.androidVersions.map((v) => Number(v.value)),
        versionCodes: [
          ...new Set(
            detail.reports
              .map((r) => r.versionCode)
              .filter((v): v is string => Boolean(v)),
          ),
        ],
        files: detail.files,
      }),
    );
    return {
      issueId,
      summary: out.summary,
      cause: out.cause,
      fix: out.fix,
      files: out.files.length ? out.files : detail.files,
    };
  }
}
