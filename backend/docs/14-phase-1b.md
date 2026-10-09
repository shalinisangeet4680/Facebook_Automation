# Phase 1B: Settings, Reports, Creatives & Publishing, Inbox

This phase replaces the four "Soon" pages. Every feature works without our own AI. Claude, through the connector, adds design, captions and reasoning on top.

## 0. Test isolation

The local database now holds real Meta data, so tests get their own:
- **Backend:** e2e tests use `adpilot_test`, set in `test/setup-env.ts`, and migrate it before running.
- **Web:** Playwright starts its own backend on port 4100 (test database, `META_MOCK=true`) and a production web build on port 3300. It never touches the dev servers on 4000 and 3200.

## 1. Settings (`workspace_settings`)

| Field | Use |
| - | - |
| `workspaceName` | Shown in the sidebar and on the consent screen |
| `maxDailyBudget` | Per campaign or ad set; capped by the platform limit `ADS_MAX_DAILY_BUDGET` |
| `monthlyBudget` | Pacing alerts |
| `targetCostPerResult` | Thresholds for Inbox rules and the Reports badges |
| `profile.name`, `profile.email` | User profile |

API:
- `GET /api/v1/settings`
- `PUT /api/v1/settings/workspace`
- `PUT /api/v1/settings/profile`

`AdsService` reads the workspace limit, falling back to the platform limit, wherever it checks `ADS_MAX_DAILY_BUDGET` today.

Web `/settings` sections:
- Workspace
- Budget and targets
- Profile
- Connections: Meta and Claude, with links
- Security: sign out on all devices

## 2. Reports

`GET /api/v1/reports/overview?preset=last_7d|last_14d|last_30d|this_month|last_month` returns:
- KPIs for the period and the previous period of the same length: spend, results, cost per result, impressions, reach, link clicks, CTR, CPM
- a daily series: spend, results and link clicks per day
- a campaign table: spend, results, cost per result, CTR and status
- the top 5 ads by results

Results follow each campaign's objective, using the same mapping as the MCP tools. Responses are cached in Redis for 10 minutes per workspace and preset.

Web `/reports`:
- KPI tiles with change against the previous period
- two small single-axis charts (daily spend, daily results) with hover tooltips
- the campaign table with a cost-per-result badge against the target
- an empty state that explains there is no delivery yet

## 3. Creatives and publishing

### Storage

- **Port:** `MediaStorage`. The local implementation writes to `backend/storage/media`; an S3-compatible one comes later.
- **Serving:** files are public at `{APP_URL}/media/{key}`, because Instagram fetches images by URL. Keys are random (`{uuid}-{24 random chars}.png`), so they can't be guessed.

### Creatives (`creatives`)

`id`, `workspace_id`, `name`, `source` (`upload` or `claude`), `storage_key`, `mime`, `width`, `height`, `bytes`, `created_by`, `created_at`.
- **Upload:** `POST /api/v1/creatives`, multipart, PNG/JPEG/WebP up to 8 MB.
- **From Claude:** the `save_ad_creative` tool takes SVG and renders it to PNG with resvg, at 1080×1080 by default or 1080×1350 / 1080×1920.
- **Listing and deleting:** `GET /api/v1/creatives` and `DELETE /api/v1/creatives/:id`. Deleting is blocked while a scheduled post uses the creative.

### Posts (`social_posts`)

`id`, `workspace_id`, `creative_id`, `platforms` (`facebook`, `instagram`), `facebook_caption`, `instagram_caption`, `status`, `scheduled_at`, `facebook_post_id`, `facebook_permalink`, `instagram_media_id`, `instagram_permalink`, `error`, `created_by`, timestamps.

Statuses run `scheduled → publishing → published | partially_published | failed`, or `cancelled`.

- **Create:** `POST /api/v1/posts` with an optional `scheduledAt` (at least 2 minutes and at most 60 days ahead). It enqueues the `social.publish` job, delayed when scheduled.
- **Cancel:** `POST /api/v1/posts/:id/cancel` while the post is scheduled.
- **List:** `GET /api/v1/posts`.

The worker publishes through the `MetaPublishing` port:
- **Facebook:** get the Page token from `GET /{page}?fields=access_token`, then `POST /{page}/photos` with `url` and `caption`. The response includes `post_id`.
- **Instagram:** `POST /{ig}/media` with `image_url` and `caption`, poll `status_code` until `FINISHED` (up to 60 seconds), then `POST /{ig}/media_publish` and read `permalink`.
- **Failures:** each platform is attempted independently, and errors are stored per platform.

The library, `GET /api/v1/social/library?platform=facebook|instagram`, lists recent posts straight from Meta: Page `published_posts` and IG `media`, with image, text, date, likes and comments. Results are cached for 5 minutes.

### Ads from posts

A plan's creative gains an optional `post: { platform, id, permalink, imageUrl, text }`. When it is set:
- **Facebook post:** the ad creative uses `object_story_id = {pageId}_{postId}`.
- **Instagram post:** the creative uses `object_id = pageId`, `instagram_user_id`, `source_instagram_media_id` and a `call_to_action` with the website link.
- **Image:** no image link is needed. The ad preview shows the post.

### MCP tools

| Tool | Scope |
| - | - |
| `save_ad_creative` (SVG to PNG) | write |
| `list_creatives` | read |
| `list_social_posts` | read |
| `publish_post` (two-step confirmation) | write |

## 4. Inbox (suggestions, rules only)

### Suggestions (`suggestions`)

`id`, `workspace_id`, `rule`, `severity` (`critical`, `warning` or `opportunity`), `entity_type`, `entity_id`, `entity_name`, `title`, `body`, `evidence` (jsonb), `action` (jsonb: `pause`, `set_daily_budget` or `none`), `status` (`open`, `applied`, `dismissed`, `snoozed`), `snoozed_until`, `fingerprint`, `created_at`, `resolved_at`.

A unique index on the fingerprint of open suggestions means re-running never duplicates them.

### Rules

Rules are pure functions over 7-day insights at ad and ad-set level, compared with the previous 7 days. The target is `targetCostPerResult`, or the account's average cost per result when no target is set.

| Rule | Condition | Action |
| - | - | - |
| `no_results` | Ad spend ≥ 2 × target and 0 results | Pause the ad |
| `expensive` | Ad cost per result ≥ 1.5 × target with ≥ 3 results, and another active ad in the ad set | Pause the ad |
| `fatigue` | Frequency ≥ 3.5 and CTR down ≥ 30% against the previous week | Refresh the creative (no action) |
| `scale_winner` | Ad set cost per result ≤ 0.7 × target, ≥ 5 results, spend ≥ 85% of budget | Raise the daily budget 20%, within the guardrail |
| `landing_drop` | ≥ 50 link clicks and landing page views / clicks < 0.5 | Check site speed (no action) |
| `tracking_silent` | A conversion campaign is active and the Pixel has had no events for 24 hours | Critical (no action) |
| `pacing` | Projected month spend > monthly budget × 1.1 | Warning (no action) |

### Running

- The maintenance scheduler runs the rules daily at 07:30 Asia/Kolkata.
- `POST /api/v1/suggestions/refresh` runs them now, and returns `202` with a job.

### Acting

- **Apply:** pause, or set the daily budget directly. The click is the confirmation. Applying is audited.
- **Dismiss, Snooze:** snooze lasts 7 days.

### Web `/inbox`

- Plans waiting for review
- Failed posts
- Suggestions grouped by severity, each with its evidence and Apply / Dismiss / Snooze

The MCP tool `get_suggestions` lets Claude discuss them.
