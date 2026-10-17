# Play Releases and App Health

Release management and Android vitals for apps already connected in Play Reviews. The same service account connection and app list are reused; nothing new is connected.

Module: `src/modules/play-releases` (domain, application, infrastructure, interface, worker). It imports `PlayModule` for apps and keys (`PlayService.appRow`, `PlayEngine.keyFor`) and `EngineModule` for AI, the Slack notifier and workspace AI settings. Web: `/reviews/releases` and `/reviews/health` inside the Play Reviews shell.

## Play Console permissions

Invite the service account in Play Console → Users and permissions and give it, for each app (or account-wide):

| Feature | Permission |
| --- | --- |
| See tracks, releases, notes, listing languages | View app information (already needed for reviews) |
| Change rollouts, promote, save release notes | **Release to production, exclude devices, and use Play App Signing** and **Release apps to testing tracks** |
| Crash and ANR rates, crash clusters, guardian | **View app quality information** |

The Google Play Developer Reporting API must be enabled in the key's Cloud project (it already is when automatic app discovery works). Missing permissions come back as 400 errors whose message names the permission to add.

## Releases (Android Publisher API v3)

- Reads open an edit (`edits.insert`), list `edits.tracks` and `edits.listings`, then delete the edit.
- Every write is `edits.insert` → `edits.tracks.update` → `edits.commit`; a failed change deletes the edit. Writes are planned by pure functions in `domain/rollout.ts`:
  - **Increase**: set `userFraction` higher on the `inProgress` (or `halted`) release. Google can't lower a rollout, so lower values are refused.
  - **Halt**: status `halted`, fraction kept. **Resume**: back to `inProgress` at the same or a higher fraction.
  - **Complete**: status `completed`, no fraction; older completed releases leave the track, drafts stay.
  - **Promote**: copy a release (version codes, name, notes) from one track to another as completed, staged (`inProgress` with a fraction, keeping the live release) or draft. Promoting a build that isn't newer than the target's live release is refused.
  - **Release notes**: replace one release's notes per language (max 500 characters each, empty languages dropped).
- Tracks are ordered production, open testing (`beta`), closed testing (`alpha`), internal, then custom tracks.
- Every write is recorded in `play_release_events` (shown on the Releases page) and in the audit log as `play.release_<kind>`; kinds are `increased`, `halted`, `resumed`, `completed`, `promoted`, `notes_saved` and `auto_halted`, with `actor` `user`, `claude` or `guardian`.

## App health (Play Developer Reporting API v1beta1)

- `crashRateMetricSet` and `anrRateMetricSet` are queried daily by `versionCode` with `userPerceivedCrashRate` / `userPerceivedAnrRate` and `distinctUsers`, ending at the metric set's freshest day (Pacific time). Rates are user-weighted and shown as percentages, per day and per version, against the app's limits.
- `errorIssues:search` lists crash and ANR clusters (last 30 days, by distinct users); `errorReports:search` returns sample reports for one cluster. From the stack traces, `domain/stack-files.ts` picks the app's own source files (`path/File.kt:line`, most frequent first).

## Rollout guardian

- Per app settings in `play_release_guardians`: enabled (off by default), max user-perceived crash rate (default **1.09%**) and ANR rate (default **0.47%**), Google's bad-behaviour thresholds, and the minimum users measured on the new version before it is judged (default 500, summed over the window).
- The worker's `play-releases-tick` (queue `play-releases`, every 10 minutes) checks each enabled app at most every 30 minutes; **Check now** runs one app immediately.
- For each `inProgress` staged release it compares the last 7 days of the new version with the previous version (the track's live release, or the closest lower version code). It **halts** when a rate is above the limit **and** worse than the previous version; with too few users it waits. Healthy rollouts are left alone; the guardian never increases a rollout.
- A halt is an ordinary committed edit, recorded as an `auto_halted` event and `play.release_auto_halted` audit entry, and posted to the workspace's Slack webhook (Play Reviews MCP page) through the shared `ESCALATION_NOTIFIER.alert`.
- When the owner resumes or increases a release the guardian halted, that version code is remembered as `ignored_version` so it isn't halted again; the next release is watched normally.

## AI

`RELEASE_AI` in the engine module (`AnthropicReleaseAi`, or `MockReleaseAi` with `AI_MOCK=true`) uses the workspace's AI mode and key like reply drafts:

- **Release notes**: a changelog becomes What's new text in every store listing language (or the languages given), max 500 characters each. Drafts are not saved until the owner saves them on a release.
- **Crash explanation**: plain-language summary, likely cause, suggested fix and files likely involved, from the cluster, devices, Android versions, sample stack traces and the candidate files.

## API

All under `/api/v1/play-releases/apps/:appId`:

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Tracks with releases, listing languages, guardian, recent events |
| POST | `/rollout` | `{ track, action: increase \| halt \| resume \| complete, fraction? }` |
| POST | `/promote` | `{ fromTrack, toTrack, versionCodes?, mode: completed \| staged \| draft, fraction? }` |
| PUT | `/notes` | `{ track, versionCode, notes: [{ language, text }] }` |
| POST | `/notes/draft` | `{ changelog, versionName?, languages? }` → AI notes |
| GET, PUT | `/guardian` | Guardian settings |
| POST | `/guardian/check` | Run the guardian now |
| GET | `/health?days=7\|14\|28` | Daily rates, per-version rates, thresholds, active rollouts |
| GET | `/issues?type=CRASH\|ANR` | Crash clusters |
| GET | `/issues/:issueId` | Cluster with sample reports, devices, Android versions, likely files |
| POST | `/issues/:issueId/explain` | AI explanation |

## MCP tools

Read tools (any scope): `list_play_releases`, `get_app_health`, `explain_crash` (cluster, stack traces and likely files for the user's Claude Code to read the repository and propose a fix), `draft_release_notes`. Write tool: `update_rollout` (increase, halt, resume, complete), two-step with `confirm_token` like the other write tools.

## Mock

`PLAY_MOCK=true` uses `MockPlayReleasesApi`: production serves 2.3.1 (231) with 2.4.0 (240) staged at 10%, open testing has 2.5.0 (250), internal 2.5.1 (251), and the listing has en-US, hi-IN, es-419 and pt-BR. Version 240 spikes to about 2.3% crashes over the last 3 days, so the guardian halts it; packages ending in `.steady` stay healthy. Four clusters (NullPointerException, ANR, IllegalStateException, OutOfMemoryError) carry stack traces in the app's package. Keys starting with `novitals` lack the vitals permission; `.denied` packages lack release access. Commits are recorded in `mockReleaseCommits` for tests.
