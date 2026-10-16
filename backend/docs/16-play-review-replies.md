# Google Play review replies

Reply to Google Play reviews from Autopilot with templates, rules that draft or send replies, or the customer's own Claude. Every reply waits for the owner's approval unless the owner turns on auto-send for a rule.

Module: `src/modules/play` (domain, application, infrastructure, interface, worker). Web: `/reviews` and `/reviews/:id`.

## Connecting

- A **connection** is one Google Cloud service account key, stored encrypted (`CryptoService`). One connection covers every app the service account can see in Play Console.
- The owner invites the service account email in Play Console → Users and permissions with **Reply to reviews** and **View app information**.
- An **app** is a package name under a connection. Adding one checks access by listing reviews, reads the title and icon from the store listing (an edit that is always deleted), copies the preset templates into the workspace once, creates the six starter rules, and runs the first fetch.
- `PLAY_MOCK=true` swaps the Google client for a deterministic mock (8 sample reviews per package). Tests and the Playwright backend use it; never set it where real data is expected.

## Fetching

- Google's Reviews API only returns reviews **with text**, created or edited **in the last 7 days**, on the production track. Autopilot keeps its own permanent copy (`play_reviews`).
- The worker's `play-tick` job runs every 5 minutes: it sends due scheduled replies, then fetches every app not fetched in the last hour (20 per tick). **Check now** fetches one app immediately.
- A review edited after our reply is flagged `edited_after_reply` with `stars_before_edit`, and goes through the rules again if the app allows replying to edited reviews.
- Replies posted in Play Console are picked up as the review's reply.
- **History**: Play Console's monthly reviews reports (Download reports → Reviews, UTF-16 CSV) can be uploaded per app. Imported reviews never trigger rules. Rows without a review link get a `csv:` id and can't be replied to through the API; star-only ratings count in Insights but never appear in the reply inbox.

## Templates

- Placeholders `{{name}}` with an optional fallback `{{name|text}}`. Built in: `first_name` (first word of the reviewer's name, empty for "A Google user"), `app_name`, `latest_version`. Everything else comes from the app's values (`team_name`, `support_email`, `support_phone`, `support_url`, or custom).
- One wording list per language; the reviewer's language picks it (exact, then base language, then the first). Several wordings rotate deterministically per review.
- Checks: unknown or malformed placeholders, values with no fallback, and the worst-case length against Google's 350-character limit (counted in UTF-16 units, the stricter count).
- Seven presets (thank you, sorry, bug, payment, feature request, mixed, thanks for updating), in English plus Hindi for the most common ones. **Restore presets** brings back deleted ones.

## Rules and safeguards

- Ordered per app; the first enabled rule that matches decides. Conditions: stars, words that must or must not appear (in the text or the original), languages, app versions, new or edited. Actions: reply with a template, ask Claude (the review waits in "For Claude"), or don't reply.
- Mode per rule: **after approval** (default) or **automatically**, with a wait in minutes.
- Automatic replies are held for approval when: the review came in on the app's first fetch, it mentions a never-auto word (lawyer, fraud, scam, police… editable), the app's daily automatic limit is reached, or the template leaves a value missing or runs over 350 characters. Quiet hours (app time zone) push scheduled sends to the morning with up to 20 minutes of jitter.
- Every send is audited (`play.reply_sent`, actor `user` or `system`).

## Replies

`play_replies` is the outbox: `pending_approval`, `needs_claude`, `scheduled`, `sent`, `failed`, `discarded`. A partial unique index allows one active reply per review. Sending again edits the reply on Google Play (the reviewer is notified only of the first reply). Bulk reply handles up to 50 reviews with one template, holding any that need values.

## Insights

`GET /api/v1/play/apps/:id/insights?days=7|30|90|365` computes, for the period and the one before: average rating, review count, reply rate, median time to reply, reviews by star per day (per week above 45 days), average rating per bucket, star distribution, rating by the 8 newest app versions, languages, and the most common words in 1–2★ and 4–5★ reviews (stopwords in English and Hinglish removed, counted once per review).

## Claude tools (MCP)

| Tool | Scope | Does |
| - | - | - |
| `list_play_apps` | read | Apps with rating, trend and queues |
| `list_play_reviews` | read | Reviews by state and stars with drafts and translations |
| `get_review_templates` | read | Templates plus the app's values, for tone and contact details |
| `get_review_insights` | read | The Insights payload |
| `save_review_drafts` | write | Up to 25 drafts into the approval queue |
| `send_review_reply` | write | Two-step confirmed public reply |

## API

| Endpoint | Purpose |
| - | - |
| `GET/POST /play/connections`, `DELETE /play/connections/:id` | Service account keys |
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
