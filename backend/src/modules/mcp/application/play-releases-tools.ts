import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { PlayActor } from "@modules/play/application/play-engine.service";
import { PlayReleasesService } from "@modules/play-releases/application/play-releases.service";
import { ROLLOUT_ACTIONS } from "@modules/play-releases/domain/rollout";

type Run = (fn: () => Promise<unknown>) => Promise<CallToolResult>;

type Confirmed = (
  tool: string,
  args: Record<string, unknown>,
  token: string | undefined,
  preview: () => Promise<{ changes: string[]; enablesAuto: boolean }>,
  apply: () => Promise<unknown>,
) => Promise<unknown>;

export const RELEASES_INSTRUCTIONS =
  "- Google Play releases and app health: list_play_releases shows every track (internal, closed, open, production and custom) with its releases, staged rollout percentage, release notes and the rollout guardian. get_app_health gives crash and ANR rates per day and per version against Google's bad-behaviour thresholds (1.09% user-perceived crashes, 0.47% ANRs) and the top crash clusters. explain_crash returns a cluster's stack traces, devices and the app files most likely involved: read those files in the user's repository, explain the cause in plain language and propose a fix as a code change. draft_release_notes writes What's new text in every store listing language from a changelog (max 500 characters each). update_rollout increases, halts, resumes or completes a staged rollout and is two-step: show the summary, wait for an explicit yes, call again with confirm_token.";

const appId = z.string().uuid().describe("An app id from list_play_apps");

export function registerPlayReleasesReadTools(
  server: McpServer,
  ws: string,
  run: Run,
  releases: PlayReleasesService,
) {
  const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

  server.registerTool(
    "list_play_releases",
    {
      title: "Google Play releases and rollouts",
      description:
        "Every release track of one app with its releases: version codes, status (draft, inProgress, halted, completed), staged rollout percentage and release notes per language. Also the listing languages, the rollout guardian settings and its last check, and recent release activity.",
      inputSchema: { app_id: appId },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const o = await releases.overview(ws, a.app_id);
        return {
          app: o.app,
          tracks: o.tracks.map((t) => ({
            track: t.track,
            label: t.label,
            releases: t.releases.map((r) => ({
              name: r.name,
              version_codes: r.versionCodes,
              status: r.status,
              rollout_percent: r.rolloutPercent,
              notes: r.notes,
            })),
          })),
          listing_languages: o.languages,
          guardian: o.guardian,
          recent_activity: o.events.slice(0, 10).map((e) => ({
            at: e.createdAt,
            by: e.actor,
            what: e.message,
          })),
          url: releases.releasesUrl(a.app_id),
        };
      }),
  );

  server.registerTool(
    "get_app_health",
    {
      title: "Google Play app health",
      description:
        "Android vitals for one app: daily user-perceived crash and ANR rates, rates per version with whether each is over the owner's limits, active staged rollouts and the top crash and ANR clusters (use their ids with explain_crash). Rates are percentages of daily users.",
      inputSchema: {
        app_id: appId,
        days: z.union([z.literal(7), z.literal(14), z.literal(28)]).default(28),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const [health, issues] = await Promise.all([
          releases.health(ws, a.app_id, a.days),
          releases.issues(ws, a.app_id, null),
        ]);
        return {
          ...health,
          top_clusters: issues.data.slice(0, 10),
          url: releases.healthUrl(a.app_id),
        };
      }),
  );

  server.registerTool(
    "explain_crash",
    {
      title: "Crash cluster details for a fix",
      description:
        "One crash or ANR cluster from get_app_health: the cause, where it happens, sample stack traces, affected devices and Android versions, and the app source files most likely involved (path:line). Read those files in the user's repository, explain the cause in plain language and propose a concrete fix.",
      inputSchema: {
        app_id: appId,
        issue_id: z.string().regex(/^[\w-]{1,100}$/),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const detail = await releases.issueView(ws, a.app_id, a.issue_id);
        return {
          issue: detail.issue,
          likely_files: detail.files,
          devices: detail.devices,
          android_api_levels: detail.androidVersions,
          stack_traces: [
            ...new Set(detail.reports.map((r) => r.reportText)),
          ].slice(0, 3),
          url: releases.healthUrl(a.app_id),
        };
      }),
  );

  server.registerTool(
    "draft_release_notes",
    {
      title: "Draft release notes in every language",
      description:
        "Write Google Play What's new notes from a changelog in every store listing language of the app (or the languages given), at most 500 characters each. Nothing is saved; show the notes to the user. The owner saves them on the Releases page in TreeVook.",
      inputSchema: {
        app_id: appId,
        changelog: z.string().min(3).max(5000),
        version_name: z.string().max(50).optional(),
        languages: z.array(z.string().max(20)).max(80).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (a) =>
      run(async () => ({
        ...(await releases.draftNotes(ws, a.app_id, {
          changelog: a.changelog,
          versionName: a.version_name,
          languages: a.languages,
        })),
        url: releases.releasesUrl(a.app_id),
      })),
  );
}

export function registerPlayReleasesWriteTools(
  server: McpServer,
  actor: PlayActor,
  run: Run,
  confirmed: Confirmed,
  releases: PlayReleasesService,
) {
  server.registerTool(
    "update_rollout",
    {
      title: "Change a staged rollout (needs confirmation)",
      description:
        "Change the staged rollout on one track: increase (to a higher percent), halt, resume (optionally at a higher percent) or complete (100% of users). Two steps: call without confirm_token to get a summary, show it to the user, then call again with the same arguments and confirm_token after they explicitly agree.",
      inputSchema: {
        app_id: appId,
        track: z.string().regex(/^[a-zA-Z0-9:_-]{1,64}$/),
        action: z.enum(ROLLOUT_ACTIONS),
        percent: z.number().min(0.1).max(99.9).optional(),
        confirm_token: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ confirm_token, ...a }) =>
      run(async () => {
        const input = {
          track: a.track,
          action: a.action,
          fraction: a.percent === undefined ? undefined : a.percent / 100,
        };
        const preview = await releases.previewRollout(
          actor.workspaceId,
          a.app_id,
          input,
        );
        return confirmed(
          "update_rollout",
          a,
          confirm_token,
          () =>
            Promise.resolve({ changes: [preview.summary], enablesAuto: false }),
          async () => ({
            ...(await releases.rollout(actor, a.app_id, input)),
            url: releases.releasesUrl(a.app_id),
          }),
        );
      }),
  );
}
