# Google Play review replies

Reply to Google Play reviews from Replyly (inside Autopilot) with per-rating modes and templates, server-side Claude drafts, keyword rules, or the customer's own Claude through the connector. Nothing posts on its own unless a rating or rule is set to Auto.

Module: `src/modules/play` (domain, application, infrastructure, interface, worker). Web: `/reviews/*` (see the web screens doc).

## Connecting

- A **connection** is one Google Cloud service account key, stored encrypted (`CryptoService`). One connection covers every app the service account can see in Play Console.
- The owner invites the service account email in Play Console → Users and permissions with **Reply to reviews** and **View app information**.
- **Apps are found automatically.** Connecting lists every app the service account can see through the Google Play Developer **Reporting** API (`apps.search`, scope `playdeveloperreporting`) and adds each one; **Find apps** on an account runs it again, and the worker repeats it once a day per connection, so apps granted later appear on their own. Apps the account can see but can't read reviews for are reported with the reason, not added. If the Reporting API isn't enabled in the key's project, connecting stops at the API stage with a link to enable it; apps can always be added by package name.
- Adding an app checks access by listing reviews, reads the title and icon from the store listing (an edit that is always deleted), copies the built-in templates into the workspace once, sets every rating to Approval with its built-in template, creates the three starter keyword rules (payments, bugs, raised ratings), and runs the first fetch (the first 10 discovered apps immediately, the rest on the next worker tick).
- **Connecting is checked in stages** and failures carry `details: { stage, code, clientEmail }`: stage 0 `invalid_key` (unreadable key or Google rejects it), stage 1 `api_disabled` (an API is off in the key's project), stage 2 `no_permission` (apps are visible but none can be read). A new connection that fails a later stage is removed again. An account that sees no apps yet still connects.
- An app's **first successful fetch** is recorded in `first_synced_at`; until then every automatic reply waits for approval, even if earlier fetches failed.
- `PLAY_MOCK=true` swaps the Google client for a deterministic mock (8 sample reviews per package). Tests and the Playwright backend use it; never set it where real data is expected.

## Fetching

- Google's Reviews API only returns reviews **with text**, created or edited **in the last 7 days**, on the production track. Autopilot keeps its own permanent copy (`play_reviews`).
- The worker's `play-tick` job runs every 5 minutes: it sends due scheduled replies, then fetches every app not fetched in the last 15 minutes (20 per tick). **Sync now** fetches every app in turn.
- Sync failures set `sync_error_kind` (`no_permission`, `api_disabled`, `disconnected`, `quota`, `error`); `no_permission` shows the app as **Needs access**, and **Check again** (`POST /play/apps/:id/recheck`) clears it once a fetch works. A failed send with an access or key error sets it too.
- Every review gets a **topic** (Crash, Sync, Login, Payment, Performance, Ads, Feature request, Support, Praise, Other) from keywords when it arrives; an AI draft replaces it with Claude's choice.
- A review edited after our reply is flagged `edited_after_reply` with `stars_before_edit`, and goes through the rules again if the app allows replying to edited reviews.
- Replies posted in Play Console are picked up as the review's reply.
- **History from the reports bucket**: Play Console keeps monthly review reports in `gs://pubsite_prod_<developer id>/reviews/reviews_<package>_<YYYYMM>.csv`. Saving that URI on a connection (`PUT /play/connections/:id/reports`, checked by listing the bucket) lets `POST /play/apps/:id/history` read the app's files through the Cloud Storage JSON API (scope `devstorage.read_only`; the service account needs **View app information and download bulk reports** in Play Console's account permissions, which can take up to a day). Each file's `updated` stamp is kept in `play_apps.report_files`, so only new or changed months are downloaded (`?all=true` re-reads everything); the worker refreshes every app with a bucket once a day. Imported rows go through the same path as uploads.
- **History by upload**: Play Console's monthly reviews reports (Download reports → Reviews, UTF-16 CSV) can be uploaded per app. Imported reviews never trigger rules. Rows without a review link get a `csv:` id and can't be replied to through the API; star-only ratings count in Insights but never appear in the reply inbox.

## Templates

- Placeholders in single braces: `{user_name}`, `{app_name}`, `{rating}`, `{version}`, `{support_email}`, `{developer_name}`, plus any custom value. `{user_name}` falls back to "there", `{version}` to "the latest version", `{developer_name}` to "The team". The older `{{name|fallback}}` form still works, and `first_name`, `latest_version` and `team_name` are aliases.
- Each template has **ratings** ("Use for"). One wording list per language; the reviewer's language picks it (exact, then base language, then the first). Several wordings rotate deterministically per review.
- Checks: unknown or malformed placeholders, values with no fallback, and the worst-case length against Google's 350-character limit (counted in UTF-16 units, the stricter count).
- **Built-in templates** (Grateful thanks 5★, Thanks + nudge 4★, Neutral follow-up 3★, Apology & support 1–2★, Fixed in update 1–3★, plus Bug or crash, Payment or refund, Feature request and Thanks for updating) are read-only and kept in sync with the code; **Duplicate** makes an editable copy. A template used by a rating can't be deleted.

## Rules and safeguards

- **Per rating** (`settings.ratingRules`): each star rating has a mode — **Auto** (post after the posting delay), **Approval** (draft and wait) or **Manual** (no draft; the owner writes or asks for one) — and a template, or none for an AI-written reply.
- **Advanced keyword rules** run first; the first enabled match decides. Conditions: stars, words that must or must not appear (in the text or the original), languages, app versions, edited. Actions: reply with a template (approval or auto, wait in minutes), ask Claude through the connector, or don't reply.
- **Behavior** per app: reply in the reviewer's language, let AI personalize templates, skip star-only reviews, escalate 1★ reviews to Slack, safety pause, posting delay (instantly, 15 min, 1 hour, 6 hours) and voice (friendly, professional, concise).
- Automatic replies are held for approval when: the review came in on the app's first fetch, the app is safety-paused, it mentions a never-auto word (lawyer, fraud, scam, police… editable), the daily automatic limit is reached, or the draft leaves a value missing or runs over 350 characters. Quiet hours (app time zone) push scheduled sends to the morning with up to 20 minutes of jitter.
- **Safety pause:** after each sync, if the average rating of the last 24 hours (at least 5 reviews) is 0.3 or more below the 30 days before (at least 10 reviews), auto-replies pause for 24 hours, scheduled automatic replies go back to approval, and `play.safety_paused` is audited. **Resume now** ends it.
- **Escalation:** with Escalate on and a Slack incoming webhook saved, each new 1★ review is posted once to Slack with the draft and a link to the inbox.
- Every send is audited (`play.reply_sent`, actor `user` or `system`).

## AI drafting

- `AnthropicReplyAi` calls `claude-opus-5` with structured output (reply, language, topic), `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) and low effort. Refusals and API errors fall back to the plain template, or to the connector when the rating has no template.
- AI is used when a rating is AI-written, when personalizing is on, or when translating is on and the template has no wording in the reviewer's language. Rewrite asks for a different reply than the current draft.
- Workspace setting (`play_workspace_settings.ai_mode`): `platform` uses the server's `ANTHROPIC_API_KEY` within `AI_DAILY_DRAFTS` drafts a day per workspace, `own` uses the workspace's encrypted key, `off` disables it. `AI_MOCK=true` swaps in a deterministic mock for tests.

## Replies

`play_replies` is the outbox: `pending_approval`, `needs_claude`, `scheduled`, `sent`, `failed`, `discarded`, with source `template`, `ai`, `claude` or `manual`. Skipping a review discards its draft and sets `skipped_at`; drafting again clears it. A partial unique index allows one active reply per review. Sending again edits the reply on Google Play (the reviewer is notified only of the first reply). Bulk reply handles up to 50 reviews with one template, holding any that need values.

## Inbox and analytics

- `GET /play/inbox?filter=pending|replied|all&appId=` lists reviews across apps: Needs reply (no reply, not skipped, with text or a draft), Replied (replied or skipped), with counts and the ids of drafts ready for **Approve all** (`POST /play/inbox/approve-all`, up to 50).
- `GET /play/analytics?days=7|30|90&appId=` (or `from=YYYY-MM-DD&to=YYYY-MM-DD` read in the app's time zone, or `all=true` from the first review with no comparison) returns the period's reviews, reply rate, median response and rating against the period before, replies sent and time saved (1.6 minutes per reply, an estimate), reviews vs replies per day (per week past 92 days, per month past two years) with a running average rating, the rating mix, and the top topics with their change.
- App cards include the mode, a 14-day replies sparkline and pause state; the app detail adds the 30-day overview.

## Insights

`GET /api/v1/play/apps/:id/insights?days=7|30|90|365` computes, for the period and the one before: average rating, review count, reply rate, median time to reply, reviews by star per day (per week above 45 days), average rating per bucket, star distribution, rating by the 8 newest app versions, languages, and the most common words in 1–2★ and 4–5★ reviews (stopwords in English and Hinglish removed, counted once per review).

## Claude tools (MCP)

Clients connect with OAuth (the Claude connector) or with the workspace **access token** (`rk_live_…`, stored hashed and encrypted, shown on the MCP page; rotating keeps the old token working for 10 minutes). Posting from agents is off until the owner turns on **Allow agents to post replies**; until then `send_review_reply` answers `posting_disabled` and agents save drafts instead.

| Tool | Scope | Does |
| - | - | - |
| `list_play_apps` | read | Apps with rating, mode and queues |
| `list_play_reviews` | read | Reviews by state and stars with drafts and translations |
| `get_review_templates` | read | Templates plus the app's values, for tone and contact details |
| `get_review_insights` | read | Per-app insights |
| `get_review_analytics` | read | Cross-app analytics with topics |
| `draft_review_reply` | write | Draft one reply with the owner's template and voice (server-side) |
| `save_review_drafts` | write | Up to 25 drafts into the inbox |
| `upsert_review_template` | write | Create or edit the owner's templates |
| `send_review_reply` | write | Two-step confirmed public reply, only when agents may post |
| `get_review_settings` | read | An app's auto-reply switch, per-rating modes and templates, behavior, safeguards, placeholders, advanced rules, templates and workspace AI/Slack status |
| `update_review_settings` | write | Two-step: change any of those app settings; turning a rating to auto is refused unless agents may post |
| `set_review_rules` | write | Two-step: replace the advanced keyword rules; new auto rules need agent posting |
| `update_review_workspace` | write | Two-step: AI drafting mode and Slack channel (never keys, the webhook or agent posting) |
| `delete_review_template` | write | Two-step: delete one of the owner's templates |
| `sync_play_apps` | write | Find newly shared apps, then fetch reviews for every app or one |
| `import_review_history` | write | Import new or changed months from the reports bucket |

## API

| Endpoint | Purpose |
| - | - |
| `GET/POST /play/connections`, `DELETE /play/connections/:id` | Service account keys; connecting also finds and adds apps |
| `POST /play/connections/:id/discover` | Find apps the account can see and add new ones |
| `GET/POST /play/apps`, `GET/PUT/DELETE /play/apps/:id` | Apps, settings and values |
| `POST /play/apps/:id/sync` | Fetch now |
| `GET /play/apps/:id/reviews` | Inbox with state, stars, language, version and search filters |
| `GET /play/apps/:id/insights` | Charts |
| `POST /play/apps/:id/import` | Upload a Play Console reviews report |
| `POST /play/apps/:id/preview` | Fill a template for one review |
| `POST /play/apps/:id/reviews/:reviewId/reply`, `PUT …/draft` | Send now or save a draft |
| `POST /play/apps/:id/bulk-reply` | One template for many reviews |
| `POST /play/replies/:id/approve`, `…/discard` | Outbox actions |
| `GET/POST /play/templates`, `PUT/DELETE /play/templates/:id`, `POST /play/templates/check`, `POST /play/templates/presets` | Templates |
| `GET/PUT /play/apps/:id/rules` | Rules, saved as an ordered list |
| `POST /play/apps/:id/recheck`, `POST /play/apps/:id/resume` | Check reply access again; end a safety pause |
| `GET /play/inbox`, `POST /play/inbox/approve-all` | Cross-app inbox |
| `POST /play/reviews/:id/skip`, `…/unskip`, `…/draft`, `…/rewrite` | Inbox actions |
| `GET /play/analytics` | Cross-app analytics |
| `POST /play/templates/:id/duplicate` | Copy a template (built-ins are read-only) |
| `GET/PUT /play/workspace`, `POST /play/workspace/token/reveal`, `…/rotate`, `GET/DELETE /play/workspace/clients(/:id)` | AI drafting, Slack, agent posting, access token and connected clients |
